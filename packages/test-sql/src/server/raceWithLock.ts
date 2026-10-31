import { Deferred, type Duration, Effect, Fiber } from "effect";
import { SqlClient, Statement } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { observeUntil } from "#observeUntil.ts";
import { withTestTransaction } from "#withTestTransaction.ts";

function tagged<A, E, R>(effect: Effect.Effect<A, E, R>, tag: string) {
	return Effect.provideService(effect, Statement.CurrentTransformer, (statement, sql) =>
		Effect.succeed(sql`${sql.literal(`/* ${tag} */`)} ${statement}`),
	);
}

export function raceWithLock<A, E, R, TLockError, TLockServices>(options: {
	readonly lock: Effect.Effect<unknown, TLockError, TLockServices>;
	readonly effects: readonly Effect.Effect<A, E, R>[];
	readonly timeout?: Duration.Input;
	readonly release?: "commit" | "rollback";
	readonly count?: "contenders" | "every blocked session";
}) {
	const everyBlockedSession = options.count === "every blocked session";
	const timeout = options.timeout ?? "5 seconds";
	const contenders = `${options.effects.length} ${everyBlockedSession ? "sessions" : "contenders"} to block on the lock`;
	return Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const ready = yield* Deferred.make<string>();
			const started = yield* Deferred.make<void>();
			const hold = Effect.gen(function* () {
				yield* Effect.timeout(options.lock, timeout);
				const [holder] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
				const race = `raceWithLock ${holder?.pid}.`;
				yield* Deferred.succeed(ready, race);
				yield* Deferred.await(started);
				const waiting = sql`select pg_stat_clear_snapshot()`.pipe(
					Effect.andThen(sql<{ waiting: number }>`with recursive blocked(pid) as (
						select pid from pg_stat_activity where pg_backend_pid() = any(pg_blocking_pids(pid))
						union
						select activity.pid from pg_stat_activity activity join blocked on blocked.pid = any(pg_blocking_pids(activity.pid))
					) select ${everyBlockedSession ? sql`count(*)` : sql`count(distinct split_part(activity.query, ' */', 1))`}::integer as waiting
					from pg_stat_activity activity join blocked using (pid)
					where ${everyBlockedSession ? sql`true` : sql`starts_with(activity.query, ${`/* ${race}`})`}`),
					Effect.map(([row]) => row?.waiting ?? 0),
				);
				yield* observeUntil(waiting, (count) => count >= options.effects.length, contenders, { within: timeout });
			});
			const holder = yield* (
				options.release === "commit" ? transact(Effect.scoped(hold), { onSqlError: (error) => error }) : withTestTransaction(hold)
			).pipe(Effect.forkScoped);
			const race = yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(holder).pipe(Effect.andThen(Effect.never)));
			const racing = yield* Effect.forEach(
				options.effects,
				(effect, index) => Effect.result(everyBlockedSession ? effect : tagged(effect, `${race}${index}`)),
				{ concurrency: "unbounded" },
			).pipe(Effect.forkScoped);
			yield* Deferred.succeed(started, undefined);
			yield* Effect.raceFirst(Fiber.join(holder), Fiber.join(racing).pipe(Effect.andThen(Effect.never)));
			return yield* Effect.timeout(Fiber.join(racing), timeout);
		}),
	);
}
