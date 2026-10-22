import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

engine.it(
	"a push after review starts gets a fresh review without a recovery decision",
	[githubPullRequest({}), reviewerStillRunning()],
	function* ({ fleet, finishWorkers, restart, prepareWork, workerReports, movePullRequestHead, launches, publishedDecisions, reviewedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.step).toBe("reviewing");
		expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
		movePullRequestHead(MOVED);
		yield* fleet.reconcile("one");
		expect(launches()).toHaveLength(2);
		expect(publishedDecisions()).toHaveLength(0);
		finishWorkers();
		yield* restart();
		yield* fleet.reconcile("one");
		const fresh = (yield* fleet.reconcile("one")).value;
		expect(fresh.step).toBe("reviewing");
		expect(fresh.result?.head).toBe(MOVED);
		expect(fresh.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
		expect(publishedDecisions()).toHaveLength(0);
		finishWorkers();
		const ready = (yield* fleet.reconcile("one")).value;
		expect(ready.review).toMatchObject({ head: MOVED, verdict: "approved" });
		expect(ready.checks).toMatchObject({ head: MOVED, passed: true });
		expect(ready.decision?.code).toBe("reviewed-pr-ready");
		expect(publishedDecisions()).toHaveLength(1);
		expect(reviewedHeads()).toEqual([HEAD, MOVED]);
	},
);
