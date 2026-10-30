import { Clock, type Context, Deferred, Duration, Effect, Exit, Fiber, Layer, Logger, Queue, Redacted, References } from "effect";
import { HttpServer } from "effect/http";
import { SqlClient } from "effect/sql";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { appHost } from "#appHost.ts";
import { causeWords } from "#test/answers.ts";
import type { migrationLoader } from "#test/app-host/migrationLoader.ts";
import { Ping, ping, pingHandlers } from "#test/app-host/ping.ts";

interface MigrationHost {
	readonly hostUrl: Redacted.Redacted;
	readonly lifecycle: string[];
	readonly migrations: { readonly components: SchemaComponent[]; readonly loader: ReturnType<typeof migrationLoader>; readonly table: string };
	readonly table: string;
	readonly url: Redacted.Redacted;
}

export const bootMigrations = Effect.fn("MigrationStory.bootMigrations")(function* (
	state: MigrationHost,
	options: {
		mode?: "check" | "wait";
		waitTimeout?: Duration.Input;
		pollInterval?: Duration.Input;
		progressInterval?: Duration.Input;
		release?: string;
	} = {},
) {
	const logs: { level: string; message: readonly unknown[]; annotations: Record<string, unknown> }[] = [];
	const logger = Logger.make((entry) => {
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
	const next = Effect.raceFirst(
		Queue.take(sleeps).pipe(Effect.map((millis) => `sleeps ${millis} ms`)),
		Effect.raceFirst(
			Deferred.await(ready).pipe(Effect.as("ready")),
			Fiber.await(fiber).pipe(Effect.map((exit) => (Exit.isSuccess(exit) ? "ended" : causeWords(exit.cause)))),
		),
	);
	return {
		exit: Fiber.await(fiber),
		fiber,
		migrationLogs: () =>
			logs.filter((entry) => entry.message.some((message) => typeof message === "string" && message.toLowerCase().includes("database migrations"))),
		next,
		ping: Effect.gen(function* () {
			const context = yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(fiber));
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			return yield* Effect.tryPromise(() => ping(`${HttpServer.formatAddress(server.address)}/rpc`));
		}),
	};
});

export type BootedHost = Effect.Success<ReturnType<typeof bootMigrations>>;
