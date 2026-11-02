import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Fragment } from "effect/sql/Statement";

export const inValues = Effect.fnUntraced(function* (column: string | Fragment, values: readonly unknown[]) {
	const sql = yield* SqlClient.SqlClient;
	if (values.length === 0) {
		return sql`1 = 0`;
	}
	return sql`${typeof column === "string" ? sql(column) : column} in ${sql.in(values)}`;
});
