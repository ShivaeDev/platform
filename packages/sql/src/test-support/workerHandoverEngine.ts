import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Deferred, Effect, Exit, Logger, Option, Queue, Scope } from "effect";
import { SqlClient, Statement } from "effect/sql";
import { coordinateWorkerRelease } from "#coordinateWorkerRelease.ts";
import { postgresRelease } from "#postgresRelease.ts";
import { releaseWorkers } from "#releaseWorkers.ts";
import { handoverWorker } from "./handoverWorker.ts";

export type Loop = "heartbeat" | "poll";

export function inWords(cause: string) {
	return cause.includes("Connection closed") ? "connection closed" : (cause.split("\n")[0] ?? "");
}

function messageOf(message: unknown) {
	return Array.isArray(message) ? message.map(String).join(" ") : String(message);
}

export const handoverEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const client = yield* PgClient.PgClient;
	const ledger = `handover_${crypto.randomUUID().replaceAll("-", "")}_ledger`;
	const schema = `handover_jobs_${crypto.randomUUID().replaceAll("-", "")}`;
	const timeline: string[] = [];
	yield* Effect.addFinalizer(() => sql`drop schema if exists ${sql(schema)} cascade`.pipe(Effect.orDie));
	yield* Effect.addFinalizer(() =>
		Effect.forEach([`${ledger}_release`, `${ledger}_workers`], (name) => sql`drop table if exists ${sql(name)}`).pipe(Effect.orDie),
	);
	yield* postgresRelease("first", ledger).apply;
	const channel = `${ledger}_ticks`;
	const heartbeats = yield* client.listen(channel);
	const trigger = `${ledger}_heartbeat`;
	yield* sql.unsafe(`create function "${trigger}"() returns trigger language plpgsql as $$
		begin perform pg_notify('${channel}', 'heartbeat'); return new; end $$`);
	yield* Effect.addFinalizer(() => sql`drop function ${sql(trigger)}() cascade`.pipe(Effect.orDie));
	yield* sql.unsafe(`create trigger heartbeat after update on "${ledger}_workers" for each row execute function "${trigger}"()`);
	const scope = yield* Scope.fork(yield* Effect.scope);
	const draining = yield* Deferred.make<void>();
	const drained = yield* Deferred.make<void>();
	const closed = yield* Deferred.make<Exit.Exit<unknown, unknown>>();
	yield* Scope.addFinalizerExit(scope, (exit) => Deferred.succeed(closed, exit));
	const warnings = yield* Queue.unbounded<string>();
	const logged: string[] = [];
	let lastFailure: unknown;
	const loggers = yield* Logger.CurrentLoggers;
	const logger = Logger.make((options) => {
		if (options.logLevel === "Warn" && messageOf(options.message).startsWith("Worker release ")) {
			lastFailure = Option.getOrUndefined(Cause.findErrorOption(options.cause));
			const warning = `${messageOf(options.message)}: ${inWords(Cause.pretty(options.cause))}`;
			logged.push(warning);
			Queue.offerUnsafe(warnings, warning);
		}
	});
	const fault: { loop: Loop | undefined; permanent: boolean } = { loop: undefined, permanent: false };
	function targetsFault(query: string) {
		switch (fault.loop) {
			case "heartbeat":
				return query.startsWith(`update "${ledger}_workers"`);
			case "poll":
				return query.includes(`from "${ledger}_release"`);
			case undefined:
				return false;
		}
	}
	const gate = yield* coordinateWorkerRelease("first", "1 second", ledger).pipe(
		Scope.provide(scope),
		Effect.provideService(Logger.CurrentLoggers, new Set([...loggers, logger])),
		Effect.provideService(Statement.CurrentTransformer, (statement, sqlConstructor) =>
			Effect.sync(() => {
				const [query, params] = statement.compile();
				if (query.startsWith(`delete from "${ledger}_workers"`)) {
					timeline.push("first lease removal requested");
				}
				if (!targetsFault(query)) {
					return statement;
				}
				if (!fault.permanent) {
					fault.loop = undefined;
				}
				return sqlConstructor.unsafe(`${query} ${query.startsWith("update") ? "returning" : ","} pg_terminate_backend(pg_backend_pid())`, params);
			}),
		),
	);
	// Application hosts build the database and jobs Layers with independent lifetimes.
	const workerScope = yield* Scope.fork(yield* Effect.scope);
	const worker = yield* handoverWorker("first", schema, workerScope, gate, draining, drained, timeline);
	yield* Effect.addFinalizer(() => Deferred.succeed(drained, undefined));
	return {
		closed,
		draining,
		fault,
		heartbeats,
		logged,
		originalFailure: Effect.map(
			Deferred.await(closed),
			(exit) => Exit.isFailure(exit) && lastFailure !== undefined && Option.getOrUndefined(Cause.findErrorOption(exit.cause)) === lastFailure,
		),
		recordSecondRelease: postgresRelease("second", ledger).apply,
		second: yield* releaseWorkers("second", 5000, ledger),
		startSecond: Effect.gen(function* () {
			const secondScope = yield* Scope.fork(yield* Effect.scope);
			const secondGate = yield* coordinateWorkerRelease("second", "1 second", ledger).pipe(Scope.provide(secondScope));
			return yield* handoverWorker("second", schema, secondScope, secondGate, draining, drained, timeline);
		}),
		timeline,
		warnings,
		worker,
	};
});
