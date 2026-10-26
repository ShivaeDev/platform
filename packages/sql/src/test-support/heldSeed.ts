import { Deferred, Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
export const heldSeed = Effect.fnUntraced(function* (orders: string) {
	const sql = yield* SqlClient.SqlClient;
	const entered = yield* Deferred.make<number>();
	const release = yield* Deferred.make<void>();
	const loader = Migrator.fromRecord({
		"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
		"2_seed_orders": Effect.gen(function* () {
			const [backend] = yield* sql<{
				pid: number;
			}>`select pg_backend_pid() as pid`;
			yield* Deferred.succeed(entered, backend?.pid ?? 0);
			yield* Deferred.await(release);
			yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
		}),
	});
	return {
		entered: Deferred.await(entered).pipe(Effect.timeout("5 seconds")),
		loader,
		release: Deferred.succeed(release, undefined),
	};
});
