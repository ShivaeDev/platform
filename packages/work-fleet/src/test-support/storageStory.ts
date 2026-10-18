import type { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { postgresEnabled, postgresLayer, postgresOptions } from "#test/postgres.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { makeTestStore } from "#test/storage.ts";
import { readCommittedRecord, storageMigrationVerbs } from "#test/storageVerbs.ts";

const definition = {
	clock: "live" as const,
	*create() {
		const store = yield* makeTestStore(STORAGE_NAMESPACE);
		const sql = yield* SqlClient.SqlClient;
		return { namespace: STORAGE_NAMESPACE, sql, store };
	},
	layer: postgresLayer,
	name: "fleet storage",
	runIf: postgresEnabled,
	stages: [] as const,
	verbs: (
		{ store, sql, namespace }: { store: Effect.Success<ReturnType<typeof makeTestStore>>; sql: SqlClient.SqlClient; namespace: string },
		story: { tell: (line: string) => void },
	) => ({
		...storageMigrationVerbs(story.tell),
		namespace,
		readCommittedRecord: (databaseNamespace: string, workId: string) => {
			story.tell(`read committed record ${workId} through a new connection`);
			return readCommittedRecord(databaseNamespace, workId);
		},
		sql,
		store: {
			...store,
			compareAndSet: (...args: Parameters<typeof store.compareAndSet>) => {
				story.tell(`replace ${args[0]} at version ${args[1]}`);
				return store.compareAndSet(...args);
			},
			foreignReservations: () => {
				story.tell("read foreign reservations");
				return store.foreignReservations();
			},
			insert: (...args: Parameters<typeof store.insert>) => {
				story.tell(`insert ${args[0].workId}`);
				return store.insert(...args);
			},
			list: () => {
				story.tell("read stored records");
				return store.list();
			},
			load: (...args: Parameters<typeof store.load>) => {
				story.tell(`read stored record ${args[0]}`);
				return store.load(...args);
			},
			releaseForeign: (...args: Parameters<typeof store.releaseForeign>) => {
				story.tell(`release foreign owner ${args[0]}`);
				return store.releaseForeign(...args);
			},
			reserveForeign: (...args: Parameters<typeof store.reserveForeign>) => {
				story.tell(`reserve foreign owner ${args[0]}`);
				return store.reserveForeign(...args);
			},
		},
	}),
};

export const storage = storyKit({ ...definition, around: withTestTransaction });
export const isolatedStorage = storyKit({ ...definition, around: withIsolatedDatabase });

export const snapshotStorage = storyKit({
	...definition,
	around: withIsolatedDatabase,
	layer: makePostgresTestLayer({ ...postgresOptions, maxConnections: 3 }),
});

export const timedStorage = storyKit({ ...definition, around: withTestTransaction, clock: "test" });
