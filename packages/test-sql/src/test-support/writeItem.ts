import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export function writeItem(value: string) {
	return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`);
}
