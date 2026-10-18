import { Effect } from "effect";
import { dual } from "effect/Function";
import { SqlClient } from "effect/sql";
import { assertPostgresMigrations } from "#assertPostgresMigrations.ts";
import { migratePostgres } from "#migrations.ts";
import { makeRepository } from "#repository.ts";
import { withChangeCoverage } from "#testing.ts";
import { invalidateOnCommit, transact } from "#transact.ts";
import type { arraySamples } from "./arraySamples.ts";
import { watchChanges } from "./changeObservation.ts";
import type { compositeMeasurements } from "./compositeMeasurements.ts";
import type { compositeReadings } from "./compositeReadings.ts";
import type { conflictAccounts } from "./conflictAccounts.ts";
import type { constrainedItems } from "./constrainedItems.ts";
import { fixture } from "./fixture.ts";
import type { generatedRows } from "./generatedRows.ts";
import type { invoiceLines } from "./invoiceLines.ts";
import type { jsonReceipts } from "./jsonReceipts.ts";
import { migrate } from "./migrationConcurrency.ts";
import type { migrationTables } from "./migrationTables.ts";
import type { notificationTable } from "./notificationTable.ts";
import type { setupBatch } from "./postgresBatch.ts";
import type { setup as payments } from "./postgresCodecs.ts";
import type { startNotifications } from "./postgresNotify.ts";
import type { secondPool, setup as transactions } from "./postgresTransact.ts";
import type { setupVersioned } from "./postgresVersioned.ts";
import { RecordedLogs } from "./RecordedLogs.ts";
import type { labelsWithPrefix, setup as lines } from "./sqliteRepository.ts";
import type { secondDatabase, setup as sqliteTransactions } from "./sqliteTransactions.ts";
import type { wideRows } from "./wideRows.ts";
export const sqlEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const logs = yield* RecordedLogs;
	return {
		arraySamples: fixture<Effect.Success<typeof arraySamples>>(),
		batch: fixture<Effect.Success<typeof setupBatch>>(),
		compositeMeasurements: fixture<Effect.Success<typeof compositeMeasurements>>(),
		compositeReadings: fixture<Effect.Success<typeof compositeReadings>>(),
		conflictAccounts: fixture<Effect.Success<typeof conflictAccounts>>(),
		constrainedItems: fixture<Effect.Success<typeof constrainedItems>>(),
		generatedRows: fixture<Effect.Success<typeof generatedRows>>(),
		invoiceLines: fixture<Effect.Success<typeof invoiceLines>>(),
		jsonReceipts: fixture<Effect.Success<typeof jsonReceipts>>(),
		labels: fixture<Effect.Success<typeof labelsWithPrefix>>(),
		lines: fixture<Effect.Success<typeof lines>>(),
		logs,
		migrations: fixture<Effect.Success<typeof migrationTables>>(),
		notifications: fixture<Effect.Success<ReturnType<typeof startNotifications>>>(),
		notificationTable: fixture<Effect.Success<typeof notificationTable>>(),
		observer: fixture<Effect.Success<typeof secondPool>>(),
		payments: fixture<Effect.Success<typeof payments>>(),
		secondSqlite: fixture<Effect.Success<typeof secondDatabase>>(),
		sql,
		sqliteTransactions: fixture<Effect.Success<typeof sqliteTransactions>>(),
		transactions: fixture<Effect.Success<typeof transactions>>(),
		versions: fixture<Effect.Success<typeof setupVersioned>>(),
		wideRows: fixture<Effect.Success<typeof wideRows>>(),
	};
});
export function sqlVerbs(engine: Effect.Success<ReturnType<typeof sqlEngine>>) {
	const notifyTransact: typeof transact = dual(2, (effect: Effect.Effect<unknown, unknown, never>, options: Parameters<typeof transact>[1]) => {
		const transaction = transact(effect, options);
		const binding = engine.notifications.peek()?.binding;
		return binding === undefined ? transaction : Effect.provideContext(transaction, binding);
	});
	return {
		arraySamples: engine.arraySamples.get,
		assertPostgresMigrations,
		batchFixture: engine.batch.get,
		compositeMeasurements: engine.compositeMeasurements.get,
		compositeReadings: engine.compositeReadings.get,
		conflictAccounts: engine.conflictAccounts.get,
		constrainedItems: engine.constrainedItems.get,
		generatedRows: engine.generatedRows.get,
		invalidateOnCommit,
		invoiceLines: engine.invoiceLines.get,
		jsonReceipts: engine.jsonReceipts.get,
		labels: engine.labels.get,
		makeRepository,
		migrate,
		migratePostgres,
		migrations: engine.migrations.get,
		notifications: engine.notifications.get,
		notificationTable: engine.notificationTable.get,
		observerPool: engine.observer.get,
		paymentFixture: engine.payments.get,
		recordedLogs: () => engine.logs,
		secondSqliteDatabase: engine.secondSqlite.get,
		sql: engine.sql,
		sqliteLines: engine.lines.get,
		sqliteTransactions: engine.sqliteTransactions.get,
		transact: notifyTransact,
		transactions: engine.transactions.get,
		versions: engine.versions.get,
		watchChanges,
		wideRows: engine.wideRows.get,
		withChangeCoverage,
	};
}
export function sqlSnapshot(engine: Effect.Success<ReturnType<typeof sqlEngine>>) {
	return {
		logs: engine.logs,
		migrations: engine.migrations.peek(),
		notifications: engine.notifications.peek()?.state,
		transactions: engine.transactions.peek() ?? engine.sqliteTransactions.peek(),
	};
}
