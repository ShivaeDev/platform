import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { backlog, executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewRequestsRepairs } from "#test/engineTraits.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";

for (const failedChecks of [false, true]) {
	for (const execution of ["completed", "failed", "interrupted"] as const) {
		engine.it(
			`a merged PR with ${failedChecks ? "failing checks" : "changes requested"} and queued guidance releases after its repair turn is ${execution}`,
			[githubPullRequest({ failed: failedChecks }), reviewRequestsRepairs(!failedChecks)],
			function* ({ fixture, fleet, pullRequest, prepareWork, workerReports }) {
				const github = pullRequest();
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				workerReports(REPORT);
				const repairing = yield* fleet.reconcile("one");
				expect(repairing.value.stage).toBe("executing");
				expect(repairing.value.review?.verdict).toBe(failedChecks ? "approved" : "changes");
				const guidance = "Keep the requested repair focused.";
				yield* fleet.queueAnswer("one", guidance);
				const launches = [...fixture.settings];
				github.state.status = "MERGED";
				const active = yield* fleet.reconcile("one");
				expect(executing(active.value)).toBe(true);
				expect(active.value.pendingAnswers).toEqual([guidance]);
				const receipt = repairing.value.attempts.at(-1)?.receipt ?? (yield* Effect.die("Missing repair receipt"));
				fixture.observations.set(receipt.turnId, { execution, output: "", provisioning: "ready", receipt });
				const released = yield* fleet.reconcile("one");
				expect(released.value.stage).toBe("released");
				expect(released.value.releaseReason).toBe(`PR #7 merged by a human at ${HEAD}; Fleet review covered ${HEAD}`);
				expect(released.value.outcome).toBeUndefined();
				expect(backlog(released.value)).toBe(false);
				expect(executing(released.value)).toBe(false);
				expect(fixture.launched).toHaveLength(2);
				expect(released.value.attempts).toHaveLength(3);
				expect((yield* fleet.reconcile("one")).version).toBe(released.version);
				expect(fixture.settings).toEqual(launches);
			},
		);
	}
}
