import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Statement } from "effect/sql/Statement";

export const tryPurgeLock = Effect.fnUntraced(function* (tableName: string) {
	const sql = yield* SqlClient.SqlClient;
	const [identifier] = sql`${sql(tableName)}`.compile();
	const key = sql`hashtextextended('@shivaedev/sql/deleteBatched:' || ${identifier}::regclass::oid::text, 0)`;
	const connection = yield* sql.reserve;
	function execute(statement: Statement<Readonly<Record<string, unknown>>>) {
		const [text, parameters] = statement.compile();
		return connection.execute(text, parameters, undefined);
	}
	const [lock] = yield* Effect.acquireRelease(execute(sql`select pg_try_advisory_lock(${key}) as acquired`), (rows) =>
		rows[0]?.acquired === true ? Effect.orDie(execute(sql`select pg_advisory_unlock(${key})`)) : Effect.void,
	);
	return lock?.acquired === true;
});
