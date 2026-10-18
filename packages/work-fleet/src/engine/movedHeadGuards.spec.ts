import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";

for (const contextChanged of [false, true]) {
	engine.it(
		`a moved head with ${contextChanged ? "changed Board context" : "paths outside the reserved scope"} requires a decision before another review`,
		[githubPullRequest({}), reviewerStillRunning()],
		function* ({ fixture, fleet, finishWorkers, editWork, pullRequest, startReview }) {
			const github = pullRequest();
			yield* startReview();
			finishWorkers();
			const approved = yield* fleet.reconcile("one");
			github.state.head = MOVED;
			if (contextChanged) {
				editWork("one", "new-context");
			} else {
				github.state.paths = ["src/one.ts", "src/outside.ts"];
			}
			const held = yield* fleet.reconcile("one");
			expect(held.value.stage).toBe("needs-human");
			expect(held.value.decision?.reason).toBe(contextChanged ? "Board context changed" : "Result needs evidence and known reserved scope");
			expect(held.value.attentionOwner).toBe(contextChanged ? "maintainer" : "orchestrator");
			expect(held.value.result).toEqual(approved.value.result);
			expect(held.value.review).toEqual(contextChanged ? undefined : approved.value.review);
			expect(held.value.mergeReadyAt).toBeUndefined();
			expect(held.value.outcome).toBeUndefined();
			expect(fixture.reviews).toEqual([HEAD]);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}
