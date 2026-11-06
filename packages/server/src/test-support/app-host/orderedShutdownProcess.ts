import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Clock, Config, Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { acknowledgeHostSignal, reportHostReady } from "@shivaedev/test-kits/host/processChild.ts";
import { hostProcessReadouts } from "@shivaedev/test-kits/host/processReadouts.ts";
import { untilTimer, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { appDatabase, appHost } from "#appDatabase.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { observeFinalizers } from "./observeFinalizers.ts";
import { HTTP_GRACE_MILLIS, ShutdownApi } from "./ShutdownApi.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const readouts = yield* hostProcessReadouts;
		const stalled = (yield* Config.String("COLLECTOR_STALLED")) === "1";
		const scope = yield* Scope.make();
		const exported = yield* Deferred.make<void>();
		function exportReceived() {
			Effect.runFork(acknowledgeHostSignal("SIGUSR1").pipe(Effect.andThen(Deferred.succeed(exported, undefined))));
		}
		yield* Effect.acquireRelease(
			Effect.sync(() => process.on("SIGUSR1", exportReceived)),
			() => Effect.sync(() => process.off("SIGUSR1", exportReceived)),
		);
		yield* Effect.addFinalizer(() =>
			readouts
				.shutdown(
					Effect.gen(function* () {
						const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild);
						yield* untilTimer(HTTP_GRACE_MILLIS);
						yield* TestClock.adjust(HTTP_GRACE_MILLIS);
						if (stalled) {
							yield* Deferred.await(exported);
							yield* untilTimer(1000);
							yield* TestClock.adjust(1000);
						}
						yield* Fiber.join(closing);
					}),
				)
				.pipe(Effect.andThen(acknowledgeHostSignal("SIGTERM")), Effect.orDie),
		);
		const database = appDatabase({ migrations: { loader: Migrator.fromRecord({}) }, postgresSettings: {} });
		const handlers = ShutdownApi.toLayer({
			watch: () =>
				Stream.unwrap(
					Effect.map(SqlClient.SqlClient, (sql) =>
						Stream.make("watching").pipe(
							Stream.concat(Stream.never),
							Stream.ensuring(readouts.finalizer("WebSockets", sql`select 1`.pipe(Effect.withSpan("websocket drain"), Effect.orDie))),
						),
					),
				),
		});
		const host = appHost({
			config: { gracefulShutdownTimeout: HTTP_GRACE_MILLIS, host: "127.0.0.1", port: 0 },
			group: ShutdownApi,
			handlers,
			policy: "loopback",
			services: database,
		});
		const context = yield* Layer.buildWithMemoMap(
			host,
			observeFinalizers(
				readouts,
				new Map<object, string>([
					[database, "database"],
					[otlpTracing, "exporter"],
				]),
			),
			scope,
		);
		yield* reportHostReady.pipe(Effect.provideContext(context));
		yield* Effect.never;
	}).pipe(Effect.scoped, Effect.provide(Layer.effect(Clock.Clock, watchedClock).pipe(Layer.provide(TestClock.layer())))),
);
