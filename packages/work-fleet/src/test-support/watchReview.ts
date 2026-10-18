import { expect } from "@effect/vitest";
import { Effect } from "effect";
import type { ApprovedPrFixture, PrDaemonClient } from "#test/approvedPrDaemon.ts";
import { until } from "#test/cloudRestart.ts";
import { answerAndWait } from "#test/daemonActions.ts";
import { untilEveryOutput, withFollower } from "#test/follower.ts";
import type { Follower } from "#test/followerProcess.ts";
import { MOVED } from "#test/githubResult.ts";

export const watchReview = Effect.fn("WatchReviewTest.watchReview")(function* (
	fixture: ApprovedPrFixture,
	client: PrDaemonClient,
	port: number,
	initialReady: boolean,
) {
	if (initialReady) {
		yield* fixture.ready(client);
	}
	yield* withFollower(fixture.configFile, "watch", [], { follow: true, port }, (all) =>
		withFollower(fixture.configFile, "watch", ["one"], { follow: true, port }, (explicit) =>
			followReview(fixture, client, [all, explicit], initialReady),
		),
	);
});

const followReview = Effect.fn("WatchReviewTest.followReview")(function* (
	fixture: ApprovedPrFixture,
	client: PrDaemonClient,
	followers: readonly Follower[],
	initialReady: boolean,
) {
	if (!initialReady) {
		yield* fixture.ready(client);
	}
	const line = "one needs-human (waiting on orchestrator): Reviewed PR is ready to merge\n";
	yield* untilEveryOutput(followers, line);
	expect((yield* answerAndWait(client, { text: "Keep the loading indicator visible.", workId: "one" })).stage).toBe("repairing");
	yield* client("fleet.reconcile", { workId: "one" });
	fixture.finishWorker(yield* fixture.started(client, "repair"), MOVED);
	yield* until(() => client("fleet.reconcile", { workId: "one" }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")));
	yield* untilEveryOutput(followers, line.repeat(2));
	expect(followers.map((follower) => follower.output())).toEqual([line.repeat(2), line.repeat(2)]);
	expect(followers.map((follower) => follower.isRunning())).toEqual([true, true]);
});
