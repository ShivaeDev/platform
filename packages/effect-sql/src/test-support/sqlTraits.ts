import { Effect } from "effect";
import { vi } from "vitest";
import { throwingSubscriber } from "./changeObservation.ts";
import { slowCommit } from "./commitObservation.ts";
import { migrationTables } from "./migrationTables.ts";
import { notificationTable } from "./notificationTable.ts";
import { setupBatch } from "./postgresBatch.ts";
import { setup as payments } from "./postgresCodecs.ts";
import { startNotifications } from "./postgresNotify.ts";
import { secondPool, setup as transactions } from "./postgresTransact.ts";
import { setupVersioned } from "./postgresVersioned.ts";
import { labelsWithPrefix, setup as lines } from "./sqliteRepository.ts";
import { secondDatabase, setup as sqliteTransactions } from "./sqliteTransactions.ts";
import { postgres, sqlite } from "./sqlStory.ts";
export function hasTransactionTables() {
	return postgres.trait("schema", "orders and deferred foreign keys exist", function* (engine) {
		engine.transactions.set(yield* transactions);
	});
}
export function hasVersionedDocuments() {
	return postgres.trait("schema", "documents have optimistic lock versions", function* (engine) {
		engine.versions.set(yield* setupVersioned);
	});
}
export function hasMigrationTables() {
	return postgres.trait("schema", "migration tables are isolated", function* (engine) {
		engine.migrations.set(yield* migrationTables);
	});
}
export function hasInvoiceLines() {
	return sqlite.trait("schema", "invoice lines have field codecs", function* (engine) {
		engine.lines.set(yield* lines);
	});
}
export function hasSqliteTransactions() {
	return sqlite.trait("schema", "orders have deferred foreign keys", function* (engine) {
		engine.sqliteTransactions.set(yield* sqliteTransactions);
	});
}
export function hasBatchReadings() {
	return postgres.trait("schema", "readings record each batch statement", function* (engine) {
		engine.batch.set(yield* setupBatch);
	});
}
export function hasPayments() {
	return postgres.trait("schema", "payments have PostgreSQL codecs", function* (engine) {
		engine.payments.set(yield* payments);
	});
}
export function listeningForChanges(timing: Parameters<typeof startNotifications>[0] = {}, stallCleanup = false) {
	return postgres.trait("schema", "PostgreSQL changes are delivered through LISTEN and NOTIFY", function* (engine) {
		engine.notifications.set(yield* startNotifications(timing, stallCleanup));
	});
}
export function subscriberThrows(key: string) {
	return postgres.trait("schema", `the subscriber to ${key} throws`, () => throwingSubscriber(key));
}
export function commitsSlowly(seconds: number) {
	return postgres.trait("schema", `the database takes ${seconds} seconds to commit`, (engine) =>
		slowCommit(engine.sql, engine.transactions.get().tables.orders, seconds),
	);
}
export function hasLabelsWithPrefix() {
	return sqlite.trait("schema", "label codecs use an ambient prefix service", function* (engine) {
		engine.labels.set(yield* labelsWithPrefix);
	});
}
export function hasNotificationRows() {
	return postgres.trait("schema", "notification writes have deferred foreign keys", function* (engine) {
		engine.notificationTable.set(yield* notificationTable);
	});
}
export function hasBigintKeys() {
	return postgres.trait("schema", "orders can store bigint keys", (engine) => {
		const { sql, tables } = engine.transactions.get();
		return sql`alter table ${sql(tables.orders)} alter column id type bigint`.pipe(Effect.asVoid);
	});
}
export function hasObserverPool() {
	return postgres.trait("schema", "an independent PostgreSQL pool observes commits", function* (engine) {
		engine.observer.set(yield* secondPool);
	});
}
export function hasSecondSqliteDatabase() {
	return sqlite.trait("schema", "another SQLite database has its own transaction owner", function* (engine) {
		engine.secondSqlite.set(yield* secondDatabase);
	});
}
export function inTimezone(zone: string) {
	return postgres.trait("schema", `the process timezone is ${zone}`, function* () {
		vi.stubEnv("TZ", zone);
		yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
	});
}
