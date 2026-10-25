import { Effect } from "effect";
import { dual } from "effect/Function";
import { SqlClient } from "effect/sql";
import { advisoryXactLock } from "#advisoryXactLock.ts";
import { assertPostgresMigrations } from "#assertPostgresMigrations.ts";
import { migratePostgres } from "#migrations.ts";
import { pendingPostgresMigrations } from "#pendingPostgresMigrations.ts";
import { readPostgresRelease } from "#postgresRelease.ts";
import { makeRepository } from "#repository.ts";
import type { crossTableReads } from "#test/cross-table/reads.ts";
import { withChangeCoverage } from "#testing.ts";
import { invalidateOnCommit, transact } from "#transact.ts";
import type { arraySamples } from "./arraySamples.ts";
import { captureStatement } from "./captureStatement.ts";
import { watchChanges } from "./changeObservation.ts";
import { isCommitting } from "./commitObservation.ts";
import type { compositeLedger } from "./compositeLedger.ts";
import type { compositeMeasurements } from "./compositeMeasurements.ts";
import type { compositeReadings } from "./compositeReadings.ts";
import type { conflictAccounts } from "./conflictAccounts.ts";
import type { constrainedItems } from "./constrainedItems.ts";
import { explain } from "./explain.ts";
import { fixture } from "./fixture.ts";
import type { generatedRows } from "./generatedRows.ts";
import type { groupedResults } from "./groupedResults.ts";
import type { heldSeed } from "./heldSeed.ts";
import { holdAdvisoryLock } from "./holdAdvisoryLock.ts";
import type { insertSelect } from "./insertSelect.ts";
import type { invoiceLines } from "./invoiceLines.ts";
import type { jsonReceipts } from "./jsonReceipts.ts";
import type { latestRuns } from "./latestRuns.ts";
import type { migrationTables } from "./migrationTables.ts";
import type { notificationTable } from "./notificationTable.ts";
import type { partialConflicts } from "./partialConflicts.ts";
import type { setupBatch } from "./postgresBatch.ts";
import type { setup as payments } from "./postgresCodecs.ts";
import type { startNotifications } from "./postgresNotify.ts";
import type { secondPool, setup as transactions } from "./postgresTransact.ts";
import type { setupVersioned } from "./postgresVersioned.ts";
import type { pullRequests } from "./pullRequests.ts";
import { RecordedLogs } from "./RecordedLogs.ts";
import type { labelsWithPrefix, setup as lines } from "./sqliteRepository.ts";
import type { secondDatabase, setup as sqliteTransactions } from "./sqliteTransactions.ts";
import { waitingOn } from "./waitingOn.ts";
import type { wideRows } from "./wideRows.ts";
export const sqlEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const logs = yield* RecordedLogs;
	return {
		arraySamples: fixture<Effect.Success<typeof arraySamples>>(),
		batch: fixture<Effect.Success<typeof setupBatch>>(),
		compositeLedger: fixture<Effect.Success<typeof compositeLedger>>(),
		compositeMeasurements: fixture<Effect.Success<typeof compositeMeasurements>>(),
		compositeReadings: fixture<Effect.Success<typeof compositeReadings>>(),
		conflictAccounts: fixture<Effect.Success<typeof conflictAccounts>>(),
		constrainedItems: fixture<Effect.Success<typeof constrainedItems>>(),
		crossTableReads: fixture<Effect.Success<typeof crossTableReads>>(),
		generatedRows: fixture<Effect.Success<typeof generatedRows>>(),
		groupedResults: fixture<Effect.Success<typeof groupedResults>>(),
		heldSeed: fixture<Effect.Success<ReturnType<typeof heldSeed>>>(),
		insertSelect: fixture<Effect.Success<typeof insertSelect>>(),
		invoiceLines: fixture<Effect.Success<typeof invoiceLines>>(),
		jsonReceipts: fixture<Effect.Success<typeof jsonReceipts>>(),
		labels: fixture<Effect.Success<typeof labelsWithPrefix>>(),
		latestRuns: fixture<Effect.Success<typeof latestRuns>>(),
		lines: fixture<Effect.Success<typeof lines>>(),
		logs,
		migrations: fixture<Effect.Success<typeof migrationTables>>(),
		notifications: fixture<Effect.Success<ReturnType<typeof startNotifications>>>(),
		notificationTable: fixture<Effect.Success<typeof notificationTable>>(),
		observer: fixture<Effect.Success<typeof secondPool>>(),
		partialConflicts: fixture<Effect.Success<typeof partialConflicts>>(),
		payments: fixture<Effect.Success<typeof payments>>(),
		pullRequests: fixture<Effect.Success<typeof pullRequests>>(),
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
		advisoryXactLock,
		arraySamples: engine.arraySamples.get,
		assertPostgresMigrations,
		batchFixture: engine.batch.get,
		captureStatement,
		compositeLedger: engine.compositeLedger.get,
		compositeMeasurements: engine.compositeMeasurements.get,
		compositeReadings: engine.compositeReadings.get,
		conflictAccounts: engine.conflictAccounts.get,
		constrainedItems: engine.constrainedItems.get,
		crossTableReads: engine.crossTableReads.get,
		explain: (statement: readonly [string, readonly unknown[]]) => explain(engine.sql, statement),
		generatedRows: engine.generatedRows.get,
		groupedResults: engine.groupedResults.get,
		heldSeed: engine.heldSeed.get,
		holdAdvisoryLock,
		insertSelect: engine.insertSelect.get,
		invalidateOnCommit,
		invoiceLines: engine.invoiceLines.get,
		isCommitting,
		jsonReceipts: engine.jsonReceipts.get,
		labels: engine.labels.get,
		latestRuns: engine.latestRuns.get,
		makeRepository,
		migratePostgres,
		migrations: engine.migrations.get,
		notifications: engine.notifications.get,
		notificationTable: engine.notificationTable.get,
		observerPool: engine.observer.get,
		partialConflicts: engine.partialConflicts.get,
		paymentFixture: engine.payments.get,
		pendingPostgresMigrations,
		pullRequests: engine.pullRequests.get,
		readPostgresRelease,
		recordedLogs: () => engine.logs,
		secondSqliteDatabase: engine.secondSqlite.get,
		sql: engine.sql,
		sqliteLines: engine.lines.get,
		sqliteTransactions: engine.sqliteTransactions.get,
		transact: notifyTransact,
		transactions: engine.transactions.get,
		versions: engine.versions.get,
		waitingOn,
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
