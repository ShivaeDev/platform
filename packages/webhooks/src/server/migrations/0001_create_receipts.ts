import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default (schema?: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const table = sql(schema === undefined ? "webhook_receipts" : `${schema}.webhook_receipts`);
		yield* sql`create table if not exists ${table} (
		source text not null,
		delivery_id text not null,
		event text not null,
		received_at timestamptz not null default now(),
		outcome text not null check (outcome in ('queued', 'ignored')),
		job_ids jsonb not null,
		primary key (source, delivery_id)
	)`;
	});
