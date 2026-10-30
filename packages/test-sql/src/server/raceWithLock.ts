import { Deferred, type Duration, Effect, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { withTestTransaction } from "#withTestTransaction.ts";

export function raceWithLock<A, E, R, TLockError, TLockServices>(options: {
	readonly lock: Effect.Effect<unknown, TLockError, TLockServices>;
	readonly effects: readonly Effect.Effect<A, E, R>[];
	readonly timeout?: Duration.Input;
	readonly release?: "commit" | "rollback";
}) {
	return Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const ready = yield* Deferred.make<void>();
			const started = yield* Deferred.make<void>();
			const hold = Effect.gen(function* () {
				yield* options.lock;
				yield* Deferred.succeed(ready, undefined);
				yield* Deferred.await(started);
				yield* sql`select pg_stat_clear_snapshot()`.pipe(
					Effect.andThen(sql<{ waiting: number }>`with recursive blocked(pid) as (
						select pid from pg_stat_activity where pg_backend_pid() = any(pg_blocking_pids(pid))
						union
						select activity.pid from pg_stat_activity activity join blocked on blocked.pid = any(pg_blocking_pids(activity.pid))
					) select count(*)::integer as waiting from blocked`),
					Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => row?.waiting !== options.effects.length }),
				);
			});
			const holder = yield* (
				options.release === "commit" ? transact(Effect.scoped(hold), { onSqlError: (error) => error }) : withTestTransaction(hold)
			).pipe(Effect.forkScoped);
			yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(holder).pipe(Effect.andThen(Effect.never)));
			const contenders = yield* Effect.forEach(options.effects, Effect.result, { concurrency: "unbounded" }).pipe(Effect.forkScoped);
			yield* Deferred.succeed(started, undefined);
			yield* Effect.raceFirst(Fiber.join(holder), Fiber.join(contenders).pipe(Effect.andThen(Effect.never)));
			return yield* Fiber.join(contenders);
		}),
	).pipe(Effect.timeout(options.timeout ?? "5 seconds"));
}
