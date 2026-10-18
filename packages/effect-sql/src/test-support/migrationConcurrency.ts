import { Effect } from "effect";
import { type Migrator, SqlClient } from "effect/sql";
import { migratePostgres } from "#migrations.ts";
export function migrate(options: { readonly table: string; readonly loader: Migrator.Loader<SqlClient.SqlClient> }) {
	return migratePostgres({ ...options, lockTimeout: "5 seconds" });
}
export const blockedBy = Effect.fnUntraced(function* (holder: number) {
	const sql = yield* SqlClient.SqlClient;
	while (true) {
		const waiting = yield* sql<{ waiting: boolean }>`select exists (
				select 1 from pg_stat_activity where ${holder} = any(pg_blocking_pids(pid))
			) as waiting`;
		if (waiting[0]?.waiting) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
});
