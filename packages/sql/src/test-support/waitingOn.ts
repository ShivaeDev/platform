import { Effect } from "effect";
import { SqlClient } from "effect/sql";
// Lifecycle stories observe a waiter before explicitly committing, rolling back or interrupting its holder.
export const waitingOn = Effect.fnUntraced(function* (holder: number) {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ waiting: boolean }>`select exists (
		select 1 from pg_stat_activity where ${holder} = any(pg_blocking_pids(pid))
	) as waiting`;
	return rows[0]?.waiting === true;
});
