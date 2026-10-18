import { Clock, Duration, Effect, Exit, Fiber, Layer, Queue, Scope } from "effect";
import { HttpServer } from "effect/http";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { appHost } from "#server/appHost.ts";
import type { MigrationState } from "./migrationStory.ts";
import { Ping, ping, pingHandlers } from "./ping.ts";

export const bootMigrations = Effect.fn("MigrationStory.bootMigrations")(function* (
	state: MigrationState,
	options: { mode?: "check" | "wait"; waitTimeout?: Duration.Input; pollInterval?: Duration.Input } = {},
) {
	const scope = yield* Effect.acquireRelease(Scope.make(), (acquired) => Scope.close(acquired, Exit.void));
	const clock = yield* Clock.Clock;
	const sleeps = yield* Queue.unbounded<number>();
	const pollMillis = Duration.toMillis(Duration.fromInputUnsafe(options.pollInterval ?? "10 millis"));
	const host = appHost({
		application: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`select ready from ${sql(state.table)}`;
			yield* Effect.acquireRelease(
				Effect.sync(() => state.lifecycle.push("started")),
				() => Effect.sync(() => state.lifecycle.push("closed")),
			);
			return { config: { port: 0 }, group: Ping, handlers: pingHandlers, policy: "loopback" as const };
		}),
		config: { applicationName: state.table, databaseUrl: state.url },
		migrations: { ...state.migrations, mode: "wait", pollInterval: "10 millis", ...options },
	});
	const fiber = yield* Layer.buildWithScope(host, scope).pipe(
		Effect.provideService(Clock.Clock, {
			...clock,
			sleep: (duration) =>
				Effect.gen(function* () {
					const millis = Duration.toMillis(duration);
					if (millis <= pollMillis) {
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
		interrupt: Fiber.interrupt(fiber).pipe(Effect.andThen(Scope.close(scope, Exit.void))),
		next: Effect.raceFirst(
			Queue.take(sleeps).pipe(Effect.map((millis) => ({ _tag: "Sleeping" as const, millis }))),
			Fiber.await(fiber).pipe(Effect.map((exit) => ({ _tag: "Exited" as const, exit }))),
		),
		ping: Effect.gen(function* () {
			const context = yield* Fiber.join(fiber);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			return yield* Effect.tryPromise(() => ping(`${HttpServer.formatAddress(server.address)}/rpc`));
		}),
	};
});
