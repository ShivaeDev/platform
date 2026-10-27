import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";

export const webhookReceipts: SchemaComponent = {
	apply: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table if not exists webhook_receipts (
			source text not null,
			delivery_id text not null,
			event text not null,
			received_at timestamptz not null default now(),
			outcome text not null check (outcome in ('queued', 'ignored')),
			job_ids jsonb not null,
			primary key (source, delivery_id)
		)`;
	}),
	name: "webhook-receipts",
	pending: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const [row] = yield* sql<{ name: string | null }>`select to_regclass('webhook_receipts')::text as name`;
		return row === undefined || row.name === null ? "webhook_receipts is missing" : undefined;
	}),
};
