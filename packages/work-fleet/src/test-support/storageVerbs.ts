import { Effect } from "effect";
import { FleetRecord } from "#model.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { readDecisionRecords } from "#test/readDecisionRecords.ts";
import { makeTestStore } from "#test/storage.ts";
import { textRecordTables } from "#test/textRecordTables.ts";

export function storageMigrationVerbs(tell: (line: string) => void) {
	return {
		migrate: (...args: Parameters<typeof migrateFleet>) => {
			tell(`migrate Fleet namespace ${args[0]}`);
			return migrateFleet(...args);
		},
		openFleetStore: (options: FleetStoreOptions<FleetRecord>) => {
			tell(`open Fleet record store ${options.namespace}`);
			return makePostgresFleetStore(FleetRecord, options);
		},
		openStore: (namespace: string) => {
			tell(`reopen storage record store ${namespace}`);
			return makeTestStore(namespace);
		},
		readDecisions: (namespace: string) => {
			tell(`read stored decisions in ${namespace}`);
			return readDecisionRecords(namespace);
		},
		restoreLegacy: (namespace: string) => {
			tell(`restore legacy JSONB tables in ${namespace}`);
			return legacyStore(namespace);
		},
		seedTextRecords: (...args: Parameters<typeof textRecordTables>) => {
			tell(`seed legacy text records in ${args[0]}`);
			return textRecordTables(...args);
		},
	};
}

export const readCommittedRecord = Effect.fn("StorageStory.readCommittedRecord")(function* (namespace: string, workId: string) {
	const database = yield* PostgresTestDatabase;
	return yield* makeTestStore(namespace).pipe(
		Effect.flatMap((store) => store.load(workId)),
		Effect.provide(hostDatabase(database.url, "fleet-story-reader", 1)),
	);
});

import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
