import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { WorkResult } from "#policy.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

for (const archived of [false, true]) {
	test(`retry after a receiptless failed follow-up reviews the ${archived ? "archived" : "current"} repair and accepts its delivery`, () => {
		const results = new Map<string, WorkResult>();
		const receipts: string[] = [];
		let merged = false;
		return withEngine(
			{
				deliveryQuery: (result) => Effect.succeed(merged ? { head: result.head, revision: "merge-commit", url: result.pr } : undefined),
				repairs: true,
				resultQuery: (_board, observation) =>
					Effect.sync(() => {
						receipts.push(observation.receipt.turnId);
						const result = results.get(observation.receipt.turnId) ?? {
							head: `head-${results.size}`,
							kind: "change" as const,
							paths: ["src/one.ts"],
							pr: "https://example.invalid/pr/one",
						};
						results.set(observation.receipt.turnId, result);
						return result;
					}),
			},
			(fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					const repairing = yield* fleet.reconcile("one");
					expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
					finishWorkers(fixture);
					const ready = yield* fleet.reconcile("one");
					expect(ready.value.result?.head).toBe("head-1");
					expect(ready.value.review).toMatchObject({ head: "head-1", verdict: "approved" });
					const repairReceipt = ready.value.attempts.findLast((attempt) => attempt.role === "repair")?.receipt;
					fixture.rejectNextTurn();
					const failed = yield* fleet.continue("one", "Check the repaired PR again");
					expect(failed.value.step).toBe("waiting");
					expect(failed.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
					expect(failed.value.attempts.at(-1)?.receipt).toBeUndefined();
					expect(failed.value.result).toEqual(ready.value.result);
					const decisionId = failed.value.decision?.id ?? "missing";
					if (!archived) {
						yield* fixture.replaceRecord({
							...failed.value,
							attempts: [...ready.value.attempts, ...failed.value.attempts],
							history: failed.value.history?.slice(0, -1),
						});
					}
					const responseId = fixture.respond(decisionId, "retry");
					yield* fixture.restart(
						Effect.gen(function* () {
							const restarted = yield* Fleet;
							expect((yield* restarted.resolve("one", decisionId, responseId)).value.step).toBe("reviewing");
							const reviewed = yield* restarted.reconcile("one");
							expect(reviewed.value.decision?.reason).toBe("Reviewed PR is ready to merge");
							expect(reviewed.value.review?.receipt).not.toEqual(ready.value.review?.receipt);
							expect(reviewed.value.review?.head).toBe("head-1");
							expect(receipts.at(-1)).toBe(repairReceipt?.turnId);
							merged = true;
							const delivered = yield* restarted.reconcile("one");
							expect(delivered.value.step).toBe("done");
							expect(delivered.value.outcome).toMatchObject({ head: "head-1", revision: "merge-commit" });
						}),
					);
					expect(fixture.reviews).toEqual(["head-0", "head-1", "head-1"]);
				}),
		);
	});
}
