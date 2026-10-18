import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

for (const contextChanged of [false, true]) {
	engine.it(
		`a moved head with ${contextChanged ? "changed Board context" : "paths outside the reserved scope"} requires a decision before another review`,
		[githubPullRequest({}), reviewerStillRunning()],
		function* ({ fleet, finishWorkers, editWork, prepareWork, workerReports, movePullRequestHead, changePullRequestPaths, reviewedHeads, launches }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
			finishWorkers();
			const approved = yield* fleet.reconcile("one");
			movePullRequestHead(MOVED);
			if (contextChanged) {
				editWork("one", "new-context");
			} else {
				changePullRequestPaths(["src/one.ts", "src/outside.ts"]);
			}
			const held = yield* fleet.reconcile("one");
			expect(held.value.stage).toBe("needs-human");
			expect(held.value.decision?.reason).toBe(contextChanged ? "Board context changed" : "Result needs evidence and known reserved scope");
			expect(held.value.attentionOwner).toBe("orchestrator");
			expect(held.value.result).toEqual(approved.value.result);
			expect(held.value.review).toEqual(contextChanged ? undefined : approved.value.review);
			expect(held.value.mergeReadyAt).toBeUndefined();
			expect(held.value.outcome).toBeUndefined();
			expect(reviewedHeads()).toEqual([HEAD]);
			expect(launches()).toHaveLength(2);
		},
	);
}
