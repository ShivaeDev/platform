import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const tableNames = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ name: string }>`select table_name as name from information_schema.tables
		where table_schema = 'public' order by table_name`;
	return rows.map(({ name }) => name);
});
