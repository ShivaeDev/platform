import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { receiptMigrations } from "#server/internal/receiptMigrations.ts";

export interface WebhookReceiptsOptions {
	readonly schema?: string | undefined;
}

export function webhookReceipts({ schema }: WebhookReceiptsOptions = {}): SchemaComponent {
	const migrations = receiptMigrations(schema);
	const table = schema === undefined ? "webhook_receipts" : `${schema}.webhook_receipts`;
	return {
		apply: Effect.gen(function* () {
			if (schema !== undefined) {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create schema if not exists ${sql(schema)}`;
			}
			yield* migratePostgres(migrations);
		}),
		name: schema === undefined ? "webhook-receipts" : `webhook-receipts:${schema}`,
		pending: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const identifier = sql`${sql(table)}`.compile()[0];
			const [row] = yield* sql`select to_regclass(${identifier})::text as name`.withoutTransform.pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) })))),
			);
			if (row === undefined || row.name === null) {
				return `${table} is missing`;
			}
			const { migrations: pending } = yield* pendingPostgresMigrations(migrations);
			return pending.length === 0 ? undefined : `pending receipt migrations: ${pending.map(({ name }) => name).join(", ")}`;
		}),
	};
}
