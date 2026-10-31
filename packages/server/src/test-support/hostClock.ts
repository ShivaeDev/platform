import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Duration, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { TestClock } from "effect/testing";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Api, openHost } from "#test/host-clock/feature.ts";
import { followHints } from "#test/rpc/followHints.ts";

export const hostClock = storyKit({
	around: (effect) => Clock.clockWith((clock) => TestClock.withLive(withIsolatedDatabase(effect.pipe(Effect.provideService(Clock.Clock, clock))))),
	clock: "test",
	*create() {
		const testing = makePgBossTesting();
		const services = yield* openHost(testing);
		const { address } = Context.get(services, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(address)) {
			return yield* Effect.die("Expected a TCP host");
		}
		const protocol = yield* Layer.build(
			RpcClient.layerProtocolSocket().pipe(
				Layer.provide([layerWebSocket(`ws://127.0.0.1:${address.port}/rpc`), RpcSerialization.layerNdjson]),
				Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
			),
		);
		const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(protocol));
		const feed = yield* followHints(client("clock.$changes", { queries: [{ payload: undefined, query: "read" }] }));
		return { client, elapsed: 0, feed, testing };
	},
	layer: postgres,
	name: "host test clock",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (state, story) => ({
		elapsedMilliseconds: () => Effect.sync(() => state.elapsed),
		nextHint: () => state.feed.next,
		read: () => state.client("clock.read", undefined),
		sevenDaysPass: () =>
			Effect.gen(function* () {
				story.tell("seven days pass while the host, database and worker stay running");
				const live = Clock.Clock.defaultValue();
				const started = live.monotonicTimeNanosUnsafe();
				yield* TestClock.adjust("7 days");
				state.elapsed = Duration.toMillis(Duration.nanos(live.monotonicTimeNanosUnsafe() - started));
			}),
		write: (title: string) => {
			story.tell(`the client asks the worker to write ${title}`);
			return state.client("clock.write", { title }).pipe(Effect.andThen(state.testing.waitForIdle));
		},
	}),
});
