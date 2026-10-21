import { expect } from "@effect/vitest";
import { MOVED_PR_HEAD_REASON } from "#engine/deliveryFailure.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { BASE, HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

for (const legacy of [false, true]) {
	engine.it(
		`${legacy ? "retry of a legacy moved-head decision" : "another pusher moving an approved PR"} starts an independent review and accepts delivery`,
		[githubPullRequest({}), reviewerStillRunning()],
		function* ({
			fleet,
			finishWorkers,
			restart,
			respond,
			prepareWork,
			workerReports,
			replaceStoredRecord,
			upgradeDecisionCodes,
			movePullRequestHead,
			acknowledgements,
			mergePullRequest,
			reviewedHeads,
			launches,
			mergedHeads,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.step).toBe("reviewing");
			expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
			finishWorkers();
			const approved = yield* fleet.reconcile("one");
			expect(approved.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			const original = legacy && approved.value.review !== undefined ? { ...approved.value.review, document: undefined } : approved.value.review;
			const decisionId = approved.value.decision?.id ?? "missing";
			if (legacy) {
				yield* replaceStoredRecord({
					...approved.value,
					attempts: approved.value.attempts.map((attempt) =>
						attempt.role === "worker" ? { ...attempt, output: "" } : { ...attempt, reviewHead: undefined },
					),
					decision: {
						...approved.value.decision,
						code: undefined,
						id: decisionId,
						links: [PR],
						reason: MOVED_PR_HEAD_REASON,
						recommendation: "Retry",
					},
					review: original,
				});
				yield* upgradeDecisionCodes();
				expect((yield* fleet.get("one")).value.decision?.code).toBe("pr-head-moved");
				const responseId = respond(decisionId, "retry");
				yield* restart();
				const resolved = yield* fleet.resolve("one", decisionId, responseId);
				expect(resolved.value.step).toBe("delivering");
			}
			movePullRequestHead(MOVED);
			let fresh = yield* fleet.reconcile("one");
			if (legacy) {
				fresh = yield* fleet.reconcile("one");
			}
			expect(fresh.value.step).toBe("reviewing");
			expect(fresh.value.result).toMatchObject({ head: MOVED, paths: ["src/one.ts"], pr: PR, prNumber: 7 });
			expect(fresh.value.resultObservations).toEqual([approved.value.result]);
			expect(fresh.value.review).toEqual(original);
			expect(fresh.value.checks).toBeUndefined();
			expect(fresh.value.mergeReadyAt).toBeUndefined();
			expect(fresh.value.decision).toBeUndefined();
			expect(fresh.value.outcome).toBeUndefined();
			expect(fresh.value.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
			expect(fresh.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(original?.receipt.sessionId);
			expect(acknowledgements()).toContainEqual(expect.objectContaining({ disposition: legacy ? "applied" : "superseded" }));
			finishWorkers();
			const green = yield* fleet.reconcile("one");
			expect(green.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
			expect(green.value.checks).toMatchObject({ head: MOVED, passed: true });
			expect(green.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			mergePullRequest();
			yield* restart();
			const delivered = yield* fleet.reconcile("one");
			expect(delivered.value.step).toBe("done");
			expect(delivered.value.outcome).toEqual({ head: MOVED, revision: BASE, url: PR });
			expect(reviewedHeads()).toEqual([HEAD, MOVED]);
			expect(launches()).toHaveLength(3);
			expect(mergedHeads()).toEqual([]);
		},
	);
}
