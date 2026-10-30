import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Context, Deferred, Effect, Exit, Logger, Queue, Scope } from "effect";
import { SqlClient, Statement } from "effect/sql";
import { coordinateWorkerRelease } from "#coordinateWorkerRelease.ts";
import { postgresRelease } from "#postgresRelease.ts";
import { releaseWorkers } from "#releaseWorkers.ts";
import { migrationTables } from "./migrationTables.ts";

export const workerReleaseEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const client = yield* PgClient.PgClient;
	const { ledger } = yield* migrationTables;
	yield* postgresRelease("first", ledger).apply;
	const channel = `${ledger}_ticks`;
	const notifications = yield* client.listen(channel);
	const trigger = `${ledger}_heartbeat`;
	yield* sql.unsafe(`create function "${trigger}"() returns trigger language plpgsql as $$
		begin perform pg_notify('${channel}', 'heartbeat'); return new; end $$`);
	yield* Effect.addFinalizer(() => sql`drop function ${sql(trigger)}() cascade`.pipe(Effect.orDie));
	yield* sql.unsafe(`create trigger heartbeat after update on "${ledger}_workers" for each row execute function "${trigger}"()`);
	const scope = yield* Scope.fork(yield* Effect.scope);
	const draining = yield* Deferred.make<void>();
	const drained = yield* Deferred.make<void>();
	const closed = yield* Deferred.make<Exit.Exit<unknown, unknown>>();
	const failures = yield* Queue.unbounded<string>();
	const loggers = yield* Logger.CurrentLoggers;
	const logger = Logger.make((options) => {
		if (options.logLevel === "Warn") {
			Queue.offerUnsafe(failures, Cause.pretty(options.cause));
		}
	});
	let fault: "heartbeat" | "poll" | undefined;
	let permanent = false;
	let observedScope = false;
	function targetsFault(query: string) {
		switch (fault) {
			case "heartbeat":
				return query.startsWith(`update "${ledger}_workers"`);
			case "poll":
				return query.includes(`from "${ledger}_release"`);
			default:
				return false;
		}
	}
	const gate = yield* coordinateWorkerRelease("first", "1 second", ledger).pipe(
		Scope.provide(scope),
		Effect.provideService(Logger.CurrentLoggers, new Set([...loggers, logger])),
		Effect.provideService(Statement.CurrentTransformer, (statement, sqlConstructor, fiber) =>
			Effect.gen(function* () {
				if (!observedScope) {
					observedScope = true;
					yield* Scope.addFinalizerExit(Context.getUnsafe(fiber.context, Scope.Scope), (exit) => Deferred.succeed(closed, exit));
				}
				const [query, params] = statement.compile();
				if (!targetsFault(query)) {
					return statement;
				}
				if (!permanent) {
					fault = undefined;
				}
				return sqlConstructor.unsafe(`${query} ${query.startsWith("update") ? "returning" : ","} pg_terminate_backend(pg_backend_pid())`, params);
			}),
		),
	);
	yield* gate.register((active) => (active ? Effect.void : Deferred.succeed(draining, undefined).pipe(Effect.andThen(Deferred.await(drained)))));
	const second = yield* releaseWorkers("second", 5000, ledger);
	yield* Effect.addFinalizer(() => Deferred.succeed(drained, undefined));
	return {
		claimSecond: second.claim,
		closed: Deferred.await(closed).pipe(Effect.map((exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "clean shutdown"))),
		drain: postgresRelease("second", ledger).apply,
		draining: Deferred.await(draining),
		failure: Queue.take(failures),
		fault: (loop: "heartbeat" | "poll", forever = false) =>
			Effect.sync(() => {
				fault = loop;
				permanent = forever;
			}),
		finishDrain: Deferred.succeed(drained, undefined),
		heartbeat: Queue.take(notifications),
	};
});
