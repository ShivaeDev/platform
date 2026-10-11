import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { MOVED_PR_HEAD_REASON } from "#host/movedPrHead.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { BASE, HEAD, MOVED, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { startReview } from "#test/startReview.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

const movedDelivery = Effect.fn("Test.movedDelivery")(function* (legacy: boolean) {
	const github = yield* mergedReviewGithub();
	yield* withEngine({ ...github, reviewRunning: true }, (fixture) =>
		Effect.gen(function* () {
			yield* startReview(fixture);
			const fleet = yield* Fleet;
			finishWorkers(fixture);
			const approved = yield* fleet.reconcile("one");
			expect(approved.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			const original = approved.value.review;
			const decisionId = approved.value.decision?.id ?? "missing";
			if (legacy) {
				yield* fixture.replaceRecord({
					...approved.value,
					attempts: approved.value.attempts.map((attempt) =>
						attempt.role === "worker" ? { ...attempt, output: "" } : { ...attempt, reviewHead: undefined },
					),
					decision: { ...approved.value.decision, id: decisionId, links: [PR], reason: MOVED_PR_HEAD_REASON, recommendation: "Retry" },
				});
				const responseId = fixture.respond(decisionId, "retry");
				yield* fixture.restart(
					Effect.gen(function* () {
						const resolved = yield* (yield* Fleet).resolve("one", decisionId, responseId);
						expect(resolved.value.stage).toBe("delivering");
					}),
				);
			}
			github.state.head = MOVED;
			let fresh = yield* fleet.reconcile("one");
			if (legacy) {
				fresh = yield* fleet.reconcile("one");
			}
			expect(fresh.value.stage).toBe("reviewing");
			expect(fresh.value.result).toMatchObject({ head: MOVED, paths: ["src/one.ts"], pr: PR, prNumber: 7 });
			expect(fresh.value.resultObservations).toEqual([approved.value.result]);
			expect(fresh.value.review).toEqual(original);
			expect(fresh.value.checks).toBeUndefined();
			expect(fresh.value.mergeReadyAt).toBeUndefined();
			expect(fresh.value.decision).toBeUndefined();
			expect(fresh.value.outcome).toBeUndefined();
			expect(fresh.value.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
			expect(fresh.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(original?.receipt.sessionId);
			expect(fixture.acknowledgements).toContainEqual(expect.objectContaining({ disposition: legacy ? "applied" : "superseded" }));
			finishWorkers(fixture);
			const green = yield* fleet.reconcile("one");
			expect(green.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
			expect(green.value.checks).toMatchObject({ head: MOVED, passed: true });
			expect(green.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			github.state.status = "MERGED";
			const delivered = yield* fixture.restart(fleet.reconcile("one"));
			expect(delivered.value.stage).toBe("completed");
			expect(delivered.value.outcome).toEqual({ head: MOVED, revision: BASE, url: PR });
			expect(fixture.reviews).toEqual([HEAD, MOVED]);
			expect(fixture.launched).toHaveLength(3);
			expect(fixture.merged).toEqual([]);
		}),
	);
});

for (const legacy of [false, true]) {
	test(`${legacy ? "retry of a legacy moved-head decision" : "another pusher moving an approved PR"} starts an independent review and accepts delivery`, () =>
		Effect.scoped(movedDelivery(legacy)));
}
