import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect, Exit, Layer, Scope, Stream } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase } from "#appDatabase.ts";
import { appHost } from "#appHost.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { acknowledgeHostSignal, reportHostReady } from "#testing/hostProcessChild.ts";
import { hostProcessReadouts } from "#testing/hostProcessReadouts.ts";
import { observeFinalizers } from "./observeFinalizers.ts";
import { HTTP_GRACE_MILLIS, ShutdownApi } from "./orderedShutdownApi.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const readouts = yield* hostProcessReadouts;
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() =>
			readouts.shutdown(Scope.close(scope, Exit.void)).pipe(Effect.andThen(acknowledgeHostSignal("SIGTERM")), Effect.orDie),
		);
		const database = appDatabase({ migrations: { loader: Migrator.fromRecord({}) } });
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
	}).pipe(Effect.scoped),
);
