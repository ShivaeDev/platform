import { expect } from "@effect/vitest";
import type { WorkResult } from "#policy.ts";
import { engine } from "#test/engineStory.ts";
import { repairResultsByReceipt } from "#test/repairResultsByReceipt.ts";

for (const archived of [false, true]) {
	{
		const results = new Map<string, WorkResult>();
		const receipts: string[] = [];
		let merged = false;
		engine.it(
			`retry after a receiptless failed follow-up reviews the ${archived ? "archived" : "current"} repair and accepts its delivery`,
			[repairResultsByReceipt({ merged: () => merged, receipts: () => receipts, results: () => results })],
			function* ({ replaceStoredRecord, rejectNextTurn, reviewedHeads, finishWorkers, prepareWork, respond, restart, fleet }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const repairing = yield* fleet.reconcile("one");
				expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
				finishWorkers();
				const ready = yield* fleet.reconcile("one");
				expect(ready.value.result?.head).toBe("head-1");
				expect(ready.value.review).toMatchObject({ head: "head-1", verdict: "approved" });
				const repairReceipt = ready.value.attempts.findLast((attempt) => attempt.role === "repair")?.receipt;
				rejectNextTurn();
				const failed = yield* fleet.continue("one", "Check the repaired PR again");
				expect(failed.value.step).toBe("waiting");
				expect(failed.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
				expect(failed.value.attempts.at(-1)?.receipt).toBeUndefined();
				expect(failed.value.result).toEqual(ready.value.result);
				const decisionId = failed.value.decision?.id ?? "missing";
				if (!archived) {
					yield* replaceStoredRecord({
						...failed.value,
						attempts: [...ready.value.attempts, ...failed.value.attempts],
						history: failed.value.history?.slice(0, -1),
					});
				}
				const responseId = respond(decisionId, "retry");
				yield* restart();
				const restarted = fleet;
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
				expect(reviewedHeads()).toEqual(["head-0", "head-1", "head-1"]);
			},
		);
	}
}
