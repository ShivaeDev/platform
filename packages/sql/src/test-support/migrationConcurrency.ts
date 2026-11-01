import { Deferred, Effect, Fiber, Schedule } from "effect";
import type { SqlClient } from "effect/sql";
import { advisoryXactLock } from "#advisoryXactLock.ts";
import { described, type Migration } from "./migrationCatalog.ts";
import type { Applied, MigrationEngine } from "./migrationEngine.ts";
import type { RunOptions } from "./migrationVerbs.ts";

function waitersOn(sql: SqlClient.SqlClient, key: string, count: number) {
	const waiting = sql<{ readonly waiting: number }>`select count(*)::integer as waiting from pg_locks
		where locktype = 'advisory' and not granted and objsubid = 1
		and database = (select oid from pg_database where datname = current_database())
		and ((classid::bigint << 32) | objid::bigint) = hashtextextended(${key}, 0)`;
	// PostgreSQL signals nothing when a session starts waiting on a lock, so the kit polls the lock table for the ledger key's waiters.
	return waiting.pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => (row?.waiting ?? 0) < count }));
}

export function migrationConcurrency(
	engine: MigrationEngine,
	tell: (line: string) => void,
	run: (migrations: readonly Migration[], options: RunOptions, pauseLoader?: boolean) => Effect.Effect<Applied | string, never, SqlClient.SqlClient>,
) {
	const { sql, tables } = engine;
	function startPaused(migrations: readonly Migration[], options: RunOptions, pauseLoader = false) {
		return Effect.gen(function* () {
			const fiber = yield* Effect.forkScoped(run(migrations, options, pauseLoader));
			engine.paused = fiber;
			yield* Effect.raceFirst(
				Deferred.await(engine.pause.entered),
				Effect.andThen(Fiber.await(fiber), Effect.die(new Error("The runner finished before it paused"))),
			);
		});
	}
	return {
		competingRunnerWaitsOnLedger: () =>
			Effect.gen(function* () {
				const runner = engine.competing;
				if (runner === undefined) {
					return yield* Effect.die(new Error("Start the competing runner first"));
				}
				tell("PostgreSQL reports the second runner waiting on the ledger's advisory lock");
				yield* Effect.raceFirst(
					waitersOn(sql, `effect_sql_migrations:${tables.ledger}`, 1),
					Effect.andThen(Fiber.await(runner), Effect.die(new Error("The competing runner finished without waiting on the ledger lock"))),
				);
			}).pipe(Effect.orDie),
		componentEvents: () => Effect.sync(() => [...engine.componentEvents]),
		finishCompetingRunner: () =>
			Effect.gen(function* () {
				if (engine.competing === undefined) {
					return yield* Effect.die(new Error("Start the competing runner first"));
				}
				tell("the second runner finishes");
				engine.runs.push(yield* Fiber.join(engine.competing));
			}),
		interruptPausedRunner: () =>
			Effect.gen(function* () {
				if (engine.paused === undefined) {
					return yield* Effect.die(new Error("Start a paused runner first"));
				}
				tell("the paused runner is interrupted");
				yield* Fiber.interrupt(engine.paused);
			}),
		resumePausedRunner: () =>
			Effect.gen(function* () {
				const paused = engine.paused;
				if (paused === undefined) {
					return yield* Effect.die(new Error("Start a paused runner before resuming it"));
				}
				tell("the paused runner resumes and finishes its batch");
				yield* Deferred.succeed(engine.pause.resume, undefined);
				engine.runs.push(yield* Fiber.join(paused));
			}),
		runnersRaceForTheLedger: (count: number, migrations: readonly Migration[]) =>
			Effect.gen(function* () {
				tell(
					`${count} runners migrate ${described(migrations)} at once while another session holds the advisory lock effect_sql_migrations:<ledger>, which it releases once all of them wait on it`,
				);
				const key = `effect_sql_migrations:${tables.ledger}`;
				const held = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const holder = yield* Effect.forkScoped(
					sql.withTransaction(advisoryXactLock(key).pipe(Effect.andThen(Deferred.succeed(held, undefined)), Effect.andThen(Deferred.await(release)))),
				);
				yield* Deferred.await(held);
				const runners = yield* Effect.forkScoped(
					Effect.forEach(
						Array.from({ length: count }, () => run(migrations, {})),
						(runner) => runner,
						{ concurrency: "unbounded" },
					),
				);
				yield* Effect.raceFirst(
					waitersOn(sql, key, count),
					Effect.andThen(Fiber.await(runners), Effect.die(new Error("The runners finished without waiting on the ledger lock"))),
				);
				yield* Deferred.succeed(release, undefined);
				yield* Fiber.join(holder);
				const outcomes = yield* Fiber.join(runners);
				engine.runs.push(...outcomes.toSorted((left, right) => right.length - left.length));
			}).pipe(Effect.orDie),
		startCompetingRunner: (migrations: readonly Migration[], options: RunOptions = {}) =>
			Effect.gen(function* () {
				tell("a second runner starts against the same ledger");
				engine.competing = yield* Effect.forkScoped(run(migrations, options));
			}),
		startPausedRunner: (migrations: readonly Migration[]) =>
			Effect.suspend(() => {
				tell(`a runner migrates ${described(migrations)} and pauses inside the batch while it holds the ledger lock`);
				return startPaused(migrations, {});
			}),
		startRunnerPausedInComponent: (migrations: readonly Migration[], options: RunOptions = {}) =>
			Effect.suspend(() => {
				tell("a runner starts and pauses inside its schema component");
				return startPaused(migrations, { ...options, components: ["paused component"] });
			}),
		startRunnerWithPausedLoader: (migrations: readonly Migration[], options: RunOptions) =>
			Effect.suspend(() => {
				tell("an older runner starts and pauses while discovering migrations");
				return startPaused(migrations, options, true);
			}),
	};
}
