import { Deferred, Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
export function waitUntil(condition: Effect.Effect<boolean, unknown, SqlClient.SqlClient>) {
	return Effect.gen(function* () {
		while (!(yield* condition)) {
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.timeout("5 seconds"));
}
export const heldSeed = Effect.fnUntraced(function* (orders: string) {
	const sql = yield* SqlClient.SqlClient;
	const entered = yield* Deferred.make<number>();
	const release = yield* Deferred.make<void>();
	const loader = Migrator.fromRecord({
		"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
		"2_seed_orders": Effect.gen(function* () {
			const [backend] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
			yield* Deferred.succeed(entered, backend?.pid ?? 0);
			yield* Deferred.await(release);
			yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
		}),
	});
	const waiting = Effect.gen(function* () {
		const holder = yield* Deferred.await(entered);
		yield* waitUntil(
			Effect.map(
				sql<{ waiting: boolean }>`select exists (select 1 from pg_stat_activity where ${holder} = any(pg_blocking_pids(pid))) as waiting`,
				(rows) => rows[0]?.waiting === true,
			),
		);
	});
	return {
		entered: Deferred.await(entered).pipe(Effect.timeout("5 seconds")),
		loader,
		release: Deferred.succeed(release, undefined),
		waiting,
	};
});
