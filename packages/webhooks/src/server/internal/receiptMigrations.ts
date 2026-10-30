import { Migrator } from "effect/sql";
import createReceipts from "#server/migrations/0001_create_receipts.ts";
import receiptJobIds from "#server/migrations/0002_receipt_job_ids.ts";

export const receiptMigrations = {
	loader: Migrator.fromRecord({
		"0001_create_receipts": createReceipts,
		"0002_receipt_job_ids": receiptJobIds,
	}),
	lockTimeout: "5 seconds",
	table: "webhook_receipts_migrations",
} as const;
