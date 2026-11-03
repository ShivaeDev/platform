import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect, Layer, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type OtlpSpan, otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostProcess } from "#testing/hostProcess.ts";
import { DRAINING_MILLIS, ShutdownApi } from "./orderedShutdownApi.ts";

interface OrderedShutdownState {
	readonly database: Effect.Success<typeof PostgresTestDatabase>;
	host?: Effect.Success<ReturnType<typeof hostProcess>>;
	spans: () => readonly OtlpSpan[];
	stalled: boolean;
}

export const orderedShutdownHost = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Effect.fn.Return<OrderedShutdownState, never, PostgresTestDatabase> {
		return {
			database: yield* PostgresTestDatabase,
			spans: () => [],
			stalled: false,
		};
	},
	layer: postgres,
	name: "SIGTERM host drain",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => {
		function running() {
			if (state.host === undefined) {
				throw new Error("Launch the host before reading it");
			}
			return state.host;
		}
		return {
			exportedDrainSpans: () =>
				Effect.sync(() =>
					state
						.spans()
						.filter((span) => span.name === "websocket drain")
						.map((span) => span.name),
				),
			finalizers: () => Effect.suspend(() => running().finalizers()),
			launch: () =>
				Effect.gen(function* () {
					story.tell("the host starts with PostgreSQL and an OTLP collector");
					const receiver = yield* otlpReceiver({ status: state.stalled ? () => undefined : 200 });
					state.spans = () => receiver.spans;
					state.host = yield* hostProcess({
						databaseUrl: state.database.url,
						env: {
							"OTEL_BSP_EXPORT_TIMEOUT": "1000",
							"OTEL_BSP_SCHEDULE_DELAY": "60000",
							"OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url,
						},
						execArgv: ["--conditions=source"],
						module: new URL("./orderedShutdownProcess.ts", import.meta.url),
					});
				}),
			openWebSocket: () =>
				Effect.gen(function* () {
					story.tell("a real WebSocket RPC stream stays open after its first item");
					const ready = yield* Deferred.make<void, unknown>();
					const protocol = RpcClient.layerProtocolSocket().pipe(
						Layer.provide([layerWebSocket(`${running().url.replace(/^http/u, "ws")}/rpc`), RpcSerialization.layerNdjson]),
					);
					yield* RpcClient.make(ShutdownApi).pipe(
						Effect.flatMap((client) => Stream.runForEach(client.watch(), () => Deferred.succeed(ready, undefined))),
						Effect.provide(protocol),
						Effect.scoped,
						Effect.tapCause((cause) => Deferred.failCause(ready, cause)),
						Effect.forkScoped,
					);
					yield* Deferred.await(ready).pipe(Effect.timeout("5 seconds"));
				}),
			shutdownDuration: () => Effect.suspend(() => running().shutdownDuration()),
			sigterm: () => {
				story.tell(`SIGTERM interrupts the real host process within its ${DRAINING_MILLIS} ms drain budget`);
				return Effect.suspend(() => running().signal("SIGTERM")).pipe(Effect.timeout(DRAINING_MILLIS));
			},
		};
	},
});

export const stalledCollector = orderedShutdownHost.trait("configured", "the collector accepts exports without answering", (state) =>
	Effect.sync(() => {
		state.stalled = true;
	}),
);
