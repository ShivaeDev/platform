import { Data, Deferred, type Duration, Effect, Fiber, Ref, Schema } from "effect";
import { SqlClient, SqlSchema, Statement } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { observeUntil } from "#server/observeUntil.ts";
import { withTestTransaction } from "#server/withTestTransaction.ts";

function tagged<A, E, R>(effect: Effect.Effect<A, E, R>, tag: string) {
	return Effect.provideService(effect, Statement.CurrentTransformer, (statement, sql) =>
		Effect.succeed(sql`${sql.literal(`/* ${tag} */`)} ${statement}`),
	);
}

export class FinishedBeforeBlocking extends Data.TaggedError("FinishedBeforeBlocking")<{
	readonly blocked: number;
	readonly finished: readonly number[];
	readonly waitingFor: string;
}> {
	override get message() {
		return `Waited for ${this.waitingFor}, but ${this.finished.length === 1 ? "contender" : "contenders"} ${this.finished.join(", ")} finished first; ${this.blocked} blocked`;
	}
}

export function raceWithLock<A, E, R, TLockError, TLockServices>(options: {
	readonly clock?: "live" | "test";
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
			const finished = yield* Ref.make<readonly number[]>([]);
			function waitingCount(marker: string) {
				const result = SqlSchema.findAll({
					execute: () =>
						sql`with recursive blocked(pid) as (
							select pid from pg_stat_activity where pg_backend_pid() = any(pg_blocking_pids(pid))
							union
							select activity.pid from pg_stat_activity activity join blocked on blocked.pid = any(pg_blocking_pids(activity.pid))
						) select ${everyBlockedSession ? sql`count(*)` : sql`count(distinct split_part(activity.query, ' */', 1))`}::integer as waiting
						from pg_stat_activity activity join blocked using (pid)
						where ${everyBlockedSession ? sql`true` : sql`starts_with(activity.query, ${`/* ${marker}`})`}`.withoutTransform,
					Request: Schema.Void,
					Result: Schema.Struct({ waiting: Schema.Number }),
				})(undefined);
				return sql`select pg_stat_clear_snapshot()`.pipe(
					Effect.andThen(result),
					Effect.map(([row]) => row?.waiting ?? 0),
				);
			}
			const hold = Effect.gen(function* () {
				yield* options.lock;
				const [holder] = yield* SqlSchema.findAll({
					execute: () => sql`select pg_backend_pid() as pid`.withoutTransform,
					Request: Schema.Void,
					Result: Schema.Struct({ pid: Schema.Number }),
				})(undefined);
				const race = `raceWithLock ${holder?.pid}.`;
				yield* Deferred.succeed(ready, race);
				yield* Deferred.await(started);
				const blocked = Effect.gen(function* () {
					const done = yield* Ref.get(finished);
					const count = yield* waitingCount(race);
					if (done.length > 0 && count + done.length >= options.effects.length) {
						return yield* new FinishedBeforeBlocking({
							blocked: count,
							finished: [...options.effects.keys()].filter((index) => done.includes(index)),
							waitingFor: contenders,
						});
					}
					return count;
				});
				yield* observeUntil(blocked, (count) => count >= options.effects.length, contenders, {
					clock: options.clock ?? "live",
					within: timeout,
				});
			});
			const holder = yield* (options.release === "commit" ? transact(Effect.scoped(hold)) : withTestTransaction(hold)).pipe(Effect.forkScoped);
			const race = yield* Effect.raceFirst(Deferred.await(ready), Fiber.join(holder).pipe(Effect.andThen(Effect.never))).pipe(
				Effect.timeout(timeout),
			);
			const racing = yield* Effect.forEach(
				options.effects,
				(effect, index) =>
					Effect.result(everyBlockedSession ? effect : tagged(effect, `${race}${index}`)).pipe(
						Effect.ensuring(Ref.update(finished, (done) => [...done, index])),
					),
				{ concurrency: "unbounded" },
			).pipe(Effect.forkScoped);
			yield* Deferred.succeed(started, undefined);
			yield* Effect.raceFirst(Fiber.join(holder), Fiber.join(racing).pipe(Effect.andThen(Effect.never)));
			return yield* Effect.timeout(Fiber.join(racing), timeout);
		}),
	);
}
