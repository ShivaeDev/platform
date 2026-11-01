import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Statement } from "effect/sql/Statement";

export const migrationLock = Effect.fnUntraced(function* (table: string, timeout: string) {
	const sql = yield* SqlClient.SqlClient;
	const connection = yield* sql.reserve;
	function execute(statement: Statement<Readonly<Record<string, unknown>>>) {
		const [text, parameters] = statement.compile();
		return connection.execute(text, parameters, undefined);
	}
	const [previous] = yield* execute(sql`select current_setting('lock_timeout') as timeout`);
	yield* Effect.acquireRelease(execute(sql`select set_config('lock_timeout', ${timeout}, false)`), () =>
		execute(sql`select set_config('lock_timeout', ${previous?.timeout}, false)`).pipe(Effect.orDie),
	);
	const key = `effect_sql_migrations:${table}`;
	// Register cleanup before waiting so interruption also releases a lock granted just before cancellation.
	yield* Effect.addFinalizer(() => execute(sql`select pg_advisory_unlock(hashtextextended(${key}, 0))`).pipe(Effect.orDie));
	yield* execute(sql`select pg_advisory_lock(hashtextextended(${key}, 0))`);
});
