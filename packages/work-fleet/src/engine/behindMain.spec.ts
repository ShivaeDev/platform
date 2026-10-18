import { expect } from "@effect/vitest";
import { pullRequestIsBehindMain } from "#test/engineAdoptionTraits.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

{
	const setup = pullRequestIsBehindMain();
	engine.it(
		"adopts and delivers an approved, conflict-free head behind main without repeating review or validation",
		[setup],
		function* ({
			fleet,
			prepareWork,
			restart,
			workerReports,
			changePullRequestBase,
			mergePullRequest,
			checkedHeads,
			reviewedHeads,
			launches,
			mergedHeads,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.stage).toBe("needs-human");
			expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
			expect(ready.value.checks).toMatchObject({ head: HEAD, passed: true });
			changePullRequestBase(MOVED);
			expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
			yield* restart();
			const waiting = yield* fleet.reconcile("one");
			expect(waiting.version).toBe(ready.version);
			mergePullRequest(undefined, "merge-revision", MOVED);
			const delivered = yield* fleet.reconcile("one");
			expect(delivered.value.stage).toBe("completed");
			expect(delivered.value.outcome).toEqual({ head: HEAD, revision: "merge-revision", url: PR });
			expect(checkedHeads()).toEqual([HEAD]);
			expect(reviewedHeads()).toEqual([HEAD]);
			expect(launches()).toHaveLength(2);
			expect(mergedHeads()).toEqual([]);
		},
	);
}
