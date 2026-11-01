import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export interface LowMemoryPostgresOptions {
	readonly pointInTimeRecovery: boolean;
}

export const applyLowMemoryPostgres = Effect.fn("Sql.applyLowMemoryPostgres")(function* ({ pointInTimeRecovery }: LowMemoryPostgresOptions) {
	const sql = yield* SqlClient.SqlClient;
	const settings = {
		"autovacuum_max_workers": "2",
		"autovacuum_work_mem": "32MB",
		"hash_mem_multiplier": "1",
		"idle_in_transaction_session_timeout": "10min",
		"idle_session_timeout": "0",
		jit: "off",
		"max_connections": "50",
		"max_parallel_workers_per_gather": "0",
		"shared_buffers": "32MB",
		"wal_buffers": "4MB",
		"wal_compression": "zstd",
		...(pointInTimeRecovery ? { "archive_timeout": "300" } : { "archive_mode": "off" }),
	};
	for (const [name, value] of Object.entries(settings)) {
		yield* sql.unsafe(`ALTER SYSTEM SET ${name} = '${value}'`);
	}
	yield* sql`select pg_reload_conf()`;
});
