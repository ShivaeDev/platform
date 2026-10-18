import { expect } from "@effect/vitest";
import { backlog } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, PR, REPORT } from "#test/githubResult.ts";

engine.it(
	"a merged PR releases after terminal review even when result refresh would reject merged PRs",
	[githubPullRequest({}), reviewerStillRunning()],
	function* ({ fixture, fleet, finishWorkers, restart, pullRequest, prepareWork, workerReports }) {
		const github = pullRequest();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.stage).toBe("reviewing");
		expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
		github.state.status = "MERGED";
		github.state.legacyResult = true;
		finishWorkers();
		const released = yield* fleet.reconcile("one");
		expect(released.value.stage).toBe("released");
		expect(released.value.releaseReason).toBe(`PR #7 merged by a human at ${HEAD}; Fleet review covered nothing`);
		expect(released.value.outcome).toBeUndefined();
		expect(released.value.result).toEqual(reviewing.value.result);
		expect(backlog(released.value)).toBe(false);
		expect((yield* restart(fleet.reconcile("one"))).version).toBe(released.version);
		expect(fixture.launched).toHaveLength(2);
		expect(fixture.reviews).toEqual([HEAD]);
		expect(fixture.merged).toEqual([]);
	},
);
