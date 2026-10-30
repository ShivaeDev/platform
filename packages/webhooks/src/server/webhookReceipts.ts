import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { receiptMigrations } from "#server/internal/receiptMigrations.ts";

export const webhookReceipts: SchemaComponent = {
	apply: migratePostgres(receiptMigrations),
	name: "webhook-receipts",
	pending: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const [row] = yield* sql<{ name: string | null }>`select to_regclass('webhook_receipts')::text as name`;
		if (row === undefined || row.name === null) {
			return "webhook_receipts is missing";
		}
		const { migrations } = yield* pendingPostgresMigrations(receiptMigrations);
		return migrations.length === 0 ? undefined : `pending receipt migrations: ${migrations.map(({ name }) => name).join(", ")}`;
	}),
};
