import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const notificationTable = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = `notify_rows_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(table)} (id integer primary key, parent integer references ${sql(table)} (id) deferrable initially deferred)`,
		() => Effect.orDie(sql`drop table ${sql(table)}`),
	);
	return table;
});
