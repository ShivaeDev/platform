import * as PgClient from "@effect/sql-pg/PgClient";
import { Deferred, Effect, Fiber, Layer, Queue } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlError } from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type PostgresChangeClient, type PostgresNotification, postgresChanges } from "#postgresChanges.ts";
import { configured, postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";

const startupEngine = Effect.gen(function* () {
	const client = yield* PgClient.PgClient;
	const logs = yield* RecordedLogs;
	function build(channel: string, listening: PostgresChangeClient["listen"] = client.listen) {
		return Layer.build(
			postgresChanges({
				channel,
				client: new Proxy(client, { get: (target, key, receiver) => (key === "listen" ? listening : Reflect.get(target, key, receiver)) }),
				heartbeatTimeout: "1 second",
				resync: Effect.succeed(0),
			}),
		).pipe(
			Effect.as("started"),
			Effect.catchTag("SqlError", (error) => Effect.succeed({ failure: "SQL failure", message: error.message, reason: error.reason._tag })),
		);
	}
	const stallStartup = Effect.fnUntraced(function* (phase: "acquisition" | "heartbeat") {
		const stalled = yield* Deferred.make<void>();
		function listening(channel: string) {
			return Effect.gen(function* () {
				if (phase === "heartbeat") {
					yield* client.listen(channel);
				}
				yield* Deferred.succeed(stalled, undefined);
				return yield* phase === "acquisition" ? Effect.never : Queue.unbounded<PostgresNotification, SqlError>();
			});
		}
		const starting = yield* build("startup_stalled", listening).pipe(Effect.forkScoped);
		yield* Deferred.await(stalled);
		yield* TestClock.adjust("1 second");
		return yield* Fiber.join(starting);
	});
	return { build, logs, stallStartup };
});

export const listenerStartupStory = storyKit({
	clock: "test",
	create: () => startupEngine,
	layer: Layer.mergeAll(postgresLayer, Reactivity.layer, RecordedLogs.layer),
	name: "change listener startup",
	runIf: configured,
	stages: [],
	verbs: (engine) => ({
		refuseListen: () => engine.build(""),
		stallStartup: engine.stallStartup,
		startupLogs: () => engine.logs,
	}),
});
