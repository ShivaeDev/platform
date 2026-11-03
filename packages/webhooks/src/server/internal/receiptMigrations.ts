import { Migrator } from "effect/sql";
import createReceipts from "#server/migrations/0001_create_receipts.ts";
import receiptJobIds from "#server/migrations/0002_receipt_job_ids.ts";

export function receiptMigrations(schema?: string) {
	return {
		loader: Migrator.fromRecord({
			"0001_create_receipts": createReceipts(schema),
			"0002_receipt_job_ids": receiptJobIds(schema),
		}),
		lockTimeout: "5 seconds",
		table: schema === undefined ? "webhook_receipts_migrations" : `${schema}.webhook_receipts_migrations`,
	} as const;
}
