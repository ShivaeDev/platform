import { Effect } from "effect";
import type { SqlClient, SqlConnection } from "effect/sql";

export function countQueries(sql: SqlClient.SqlClient, beforeQuery: Effect.Effect<void> = Effect.void) {
	const queries: Array<{ readonly text: unknown; readonly values: unknown }> = [];
	function observe(connection: SqlConnection.Connection) {
		return {
			...connection,
			executeRaw: (text: string, values: readonly unknown[]) => {
				queries.push({ text, values });
				return Effect.andThen(beforeQuery, connection.executeRaw(text, values));
			},
		};
	}
	const observed = new Proxy(sql, {
		get(target, key, receiver) {
			return key === "reserve" ? target.reserve.pipe(Effect.map(observe)) : Reflect.get(target, key, receiver);
		},
	});
	return { queries, sql: observed };
}
