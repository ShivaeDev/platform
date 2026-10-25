import { Clock, type Context, Deferred, Duration, Effect, Fiber, Layer, Logger, Queue, Redacted, References } from "effect";
import { HttpServer } from "effect/http";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { makePgBoss } from "@shivaedev/effect-pg-boss/server/service.ts";
import { appHost } from "#server/appHost.ts";
import type { MigrationState } from "#test/app-host/migrationStory.ts";
import { Ping, ping, pingHandlers } from "#test/app-host/ping.ts";

export const bootMigrations = Effect.fn("MigrationStory.bootMigrations")(function* (
	state: MigrationState,
	options: {
		mode?: "check" | "wait";
		waitTimeout?: Duration.Input;
		pollInterval?: Duration.Input;
		progressInterval?: Duration.Input;
		release?: string;
	} = {},
) {
	const events: unknown[] = [];
	const logs: { level: string; message: readonly unknown[]; annotations: Record<string, unknown> }[] = [];
	const logger = Logger.make((entry) => {
		events.push(entry.message);
		logs.push({
			annotations: entry.fiber.getRef(References.CurrentLogAnnotations),
			level: entry.logLevel,
			message: Array.isArray(entry.message) ? entry.message : [entry.message],
		});
	});
	const clock = yield* Clock.Clock;
	const sleeps = yield* Queue.unbounded<number>();
	const pollMillis = Duration.toMillis(Duration.fromInputUnsafe(options.pollInterval ?? "10 millis"));
	const services =
		state.migrations.components.length === 0
			? Layer.empty
			: makePgBoss("@test/MigrationJobs").layer({
					connectionString: Redacted.value(state.url),
					jobs: [],
					migrate: false,
					schedule: false,
					schema: `${state.table}_jobs`,
					supervise: false,
				});
	const host = appHost({
		application: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`select ready from ${sql(state.table)}`;
			yield* Effect.acquireRelease(
				Effect.sync(() => state.lifecycle.push("started")),
				() => Effect.sync(() => state.lifecycle.push("closed")),
			);
			return {
				config: { port: 0 },
				group: Ping,
				handlers: pingHandlers,
				policy: "loopback" as const,
				services,
			};
		}),
		config: { applicationName: state.table, databaseUrl: state.hostUrl },
		migrations: { ...state.migrations, mode: "wait", pollInterval: "10 millis", ...options },
	});
	const ready = yield* Deferred.make<Context.Context<Layer.Success<typeof host>>>();
	const fiber = yield* Effect.gen(function* () {
		yield* Deferred.succeed(ready, yield* Layer.build(host));
		return yield* Effect.never;
	}).pipe(
		Effect.scoped,
		Effect.onExit((exit) => Effect.sync(() => events.push(exit))),
		Effect.provide(Logger.layer([logger])),
		Effect.provideService(Clock.Clock, {
			...clock,
			sleep: (duration) =>
				Effect.gen(function* () {
					const millis = Duration.toMillis(duration);
					if (millis === pollMillis) {
						yield* Queue.offer(sleeps, millis);
					}
					yield* clock.sleep(duration);
				}),
		}),
		Effect.forkScoped,
	);
	return {
		advance: (duration: Duration.Input) => TestClock.adjust(duration),
		exit: Fiber.await(fiber),
		interrupt: Fiber.interrupt(fiber),
		migrationLogs: () =>
			logs.filter((entry) => entry.message.some((message) => typeof message === "string" && message.toLowerCase().includes("database migrations"))),
		next: Effect.raceFirst(
			Queue.take(sleeps).pipe(Effect.map((millis) => ({ _tag: "Sleeping" as const, millis }))),
			Effect.raceFirst(
				Deferred.await(ready).pipe(Effect.as({ _tag: "Ready" as const })),
				Fiber.await(fiber).pipe(Effect.map((exit) => ({ _tag: "Exited" as const, exit }))),
			),
		),
		ping: Effect.gen(function* () {
			const context = yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(fiber));
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			return yield* Effect.tryPromise(() => ping(`${HttpServer.formatAddress(server.address)}/rpc`));
		}),
		recordedEvents: () => events,
	};
});
