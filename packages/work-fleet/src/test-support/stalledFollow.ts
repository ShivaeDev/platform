import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { until } from "#test/cloudRestart.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { followServer } from "#test/followServer.ts";

export const stalledFollow = Effect.fn("FollowTest.stalledFollow")(function* () {
	const server = yield* followServer();
	yield* withFollower("/synthetic/config.json", "watch", [], { follow: true, port: server.port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => server.subscribed);
			server.send([{ decision: { reason: "Inspect the PR" }, stage: "needs-human", workId: "one" }]);
			yield* untilOutput(follower, "one needs-human (waiting on orchestrator): Inspect the PR\n");
			server.disconnect();
			yield* until(() => Effect.succeed(server.subscriptions() === 2));
			yield* until(() => Effect.succeed(server.subscriptions() === 3)).pipe(Effect.timeout("10 seconds"));
			server.send([{ stage: "completed", workId: "one" }]);
			yield* untilOutput(follower, "one completed\n");
			yield* Effect.sleep("6 seconds");
			expect(server.subscriptions()).toBe(3);
			expect(follower.isRunning()).toBe(true);
		}),
	);
});
