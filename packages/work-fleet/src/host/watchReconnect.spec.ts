import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { until } from "#test/cloudRestart.ts";
import { withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { followServer } from "#test/followServer.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchReconnect } from "#test/watchReconnect.ts";

const test = postgresTests("live");

for (const ids of [[], ["done", "gone", "active", "waiting"]]) {
	test(`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs keeps unchanged restarts quiet and reports gap and live transitions after reconnect`, () =>
		withHost({}, {}, (fixture) => watchReconnect(fixture, ids)));
}

it.live("watch retries a stalled first snapshot after reconnect and keeps an established quiet subscription open", function* () {
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
