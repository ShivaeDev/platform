import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { hostDatabase } from "#test/hostDatabase.ts";
import { host } from "#test/hostStory.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { migrationRecords } from "#test/migrationRecords.ts";

export const brokenMigration = host.trait("configuration", "a schema migration has already run but its ledger entry was lost", (engine) => {
	engine.deferStart = true;
	engine.beforeStart = (fixture) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`delete from ${sql(`${fixture.host.namespace}_migrations`)} where migration_id >= 5`;
		}).pipe(Effect.provide(hostDatabase(fixture.host, "fleet-story-migration", 1)));
});
export const legacyRecords = host.trait("configuration", "Fleet has populated legacy JSONB records", (engine) => {
	engine.beforeStart = (fixture) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* legacyStore(fixture.host.namespace);
			yield* migrateFleet(fixture.host.namespace, "attention_owner");
			for (const value of migrationRecords()) {
				yield* sql`insert into ${sql(`${fixture.host.namespace}_records`)} (work_id, version, payload) values (${value.workId}, 7, ${JSON.stringify(value)}::jsonb)`;
			}
		}).pipe(Effect.provide(hostDatabase(fixture.host, "fleet-story-migration", 1)));
});

export const diagnosticClock = host.trait("configuration", "diagnostic requests observe a controlled wall clock", (engine) => {
	engine.diagnosticNow = 10 * 24 * 60 * 60 * 1000;
});
