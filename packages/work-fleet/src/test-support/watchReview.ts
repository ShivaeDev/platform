import { expect } from "@effect/vitest";
import { Effect } from "effect";
import type { ApprovedPrFixture, PrDaemonClient } from "#test/approvedPrDaemon.ts";
import { until } from "#test/cloudRestart.ts";
import { answerAndWait } from "#test/daemonActions.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { MOVED } from "#test/githubResult.ts";

export const watchReview = Effect.fn("WatchReviewTest.watchReview")(function* (
	fixture: ApprovedPrFixture,
	client: PrDaemonClient,
	port: number,
	ids: readonly string[],
	initialReady: boolean,
) {
	if (initialReady) {
		yield* fixture.ready(client);
	}
	yield* withFollower(fixture.configFile, "watch", ids, { follow: true, port }, (follower) =>
		Effect.gen(function* () {
			if (!initialReady) {
				yield* fixture.ready(client);
			}
			const line = "one needs-human (waiting on maintainer): Reviewed PR is ready to merge\n";
			yield* untilOutput(follower, line);
			expect((yield* answerAndWait(client, { text: "Keep the loading indicator visible.", workId: "one" })).stage).toBe("repairing");
			yield* client("fleet.reconcile", { workId: "one" });
			fixture.finishWorker(yield* fixture.started(client, "repair"), MOVED);
			yield* until(() => client("fleet.reconcile", { workId: "one" }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")));
			yield* untilOutput(follower, line.repeat(2));
			expect(follower.output()).toBe(line.repeat(2));
			expect(follower.isRunning()).toBe(true);
		}),
	);
});
