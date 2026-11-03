import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { CommittedSink } from "@shivaedev/sql/transact.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { StorageAdmission } from "#storage/errors.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { AdmissionLimits, Versioned } from "#storage/model.ts";
import { competingStorage } from "#test/competingStorage.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { postgresEnabled, postgresLayer, postgresOptions } from "#test/postgres.ts";
import { refusal } from "#test/refusal.ts";
import { STORAGE_NAMESPACE, StorageRecord } from "#test/StorageRecord.ts";
import { snapshotVerbs } from "#test/snapshotVerbs.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { makeTestStore, storageOptions, submitAgainstQuota } from "#test/storage.ts";
import { storageRecordVerbs } from "#test/storageRecordVerbs.ts";
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
		engine: { store: Effect.Success<ReturnType<typeof makeTestStore>>; sql: SqlClient.SqlClient; namespace: string },
		story: { tell: (line: string) => void },
	) => {
		let { store } = engine;
		const { sql, namespace } = engine;
		return {
			...storageRecordVerbs(() => store, story.tell),
			...storageMigrationVerbs(story.tell),
			...snapshotVerbs(sql, story.tell),
			admission: (value: typeof StorageRecord.Type, limits?: AdmissionLimits) => {
				story.tell(`admit ${value.workId} as ${value.step}`);
				return refusal(store.insert(value, limits));
			},
			admittingStore: Effect.fn("StorageStory.admittingStore")(function* (options: { readonly needsRecords?: boolean; readonly refuse?: string }) {
				story.tell(
					`open a store whose admission ${options.refuse === undefined ? "records what it sees" : `refuses with ${options.refuse}`}${options.needsRecords === false ? " without a record snapshot" : ""}`,
				);
				const seen: string[][] = [];
				const custom = yield* makePostgresFleetStore(StorageRecord, {
					...storageOptions(namespace),
					admission: (_record, _previous, records) =>
						Effect.suspend(() => {
							seen.push(records.map(({ workId }) => workId));
							return options.refuse === undefined ? Effect.void : Effect.fail(new StorageAdmission({ message: options.refuse }));
						}),
					...(options.needsRecords === false ? { admissionNeedsRecords: () => false } : {}),
				});
				return {
					admit: (value: typeof StorageRecord.Type, limits?: AdmissionLimits) => {
						story.tell(`admit ${value.workId} as ${value.step} through the custom admission`);
						return refusal(custom.insert(value, limits));
					},
					seen: () => Effect.sync(() => [...seen]),
				};
			}),
			advance: (entry: Versioned<typeof StorageRecord.Type>, change: Partial<typeof StorageRecord.Type>, limits?: AdmissionLimits) => {
				story.tell(`move ${entry.value.workId} from version ${entry.version} to ${change.step ?? entry.value.step}`);
				return refusal(store.compareAndSet(entry.value.workId, entry.version, { ...entry.value, ...change }, limits));
			},
			committedChanges: <A, E, R>(writes: Effect.Effect<A, E, R>) => {
				story.tell("Fleet writes records and foreign reservations");
				const changes: (readonly unknown[])[] = [];
				return writes.pipe(
					Effect.provideService(CommittedSink, (keys) => Effect.sync(() => changes.push(keys))),
					Effect.as(changes),
				);
			},
			competingWriter: Effect.fn("StorageStory.competingWriter")(function* () {
				story.tell("another writer races after Fleet checks the record version");
				const competing = yield* competingStorage(namespace);
				return storageRecordVerbs(() => competing, story.tell);
			}),
			concurrently: <A, E, R>(...effects: readonly Effect.Effect<A, E, R>[]) => Effect.all(effects, { concurrency: "unbounded" }),
			corruptStep: (workId: string, step: string) => {
				story.tell(`another tool writes the unknown step ${step} into ${workId}`);
				return sql`update ${sql(`${namespace}_records`)} set step = ${step} where work_id = ${workId}`;
			},
			decodedOnList: () => {
				story.tell("list stored records");
				const spans = spanCounts();
				return spans.trace(store.list()).pipe(Effect.map(() => (spans.count("FleetRow.recordValues") === 0 ? "decoded nothing" : "decoded records")));
			},
			listOutcome: () => {
				story.tell("list stored records");
				return refusal(store.list());
			},
			namespace,
			now: () => Clock.currentTimeMillis,
			readCommittedRecord: (databaseNamespace: string, workId: string) => {
				story.tell(`read committed record ${workId} through a new connection`);
				return readCommittedRecord(databaseNamespace, workId);
			},
			readOutcome: (workId: string) => {
				story.tell(`read stored record ${workId}`);
				return refusal(store.load(workId));
			},
			restart: Effect.fn("StorageStory.restart")(function* () {
				story.tell("Fleet restarts and migrates its storage");
				store = yield* makeTestStore(namespace);
				yield* migrateFleet(namespace);
			}),
			secondPasses: () => {
				story.tell("a second passes");
				return TestClock.adjust("1 second");
			},
			stepOf: (workId: string) => store.load(workId).pipe(Effect.map((entry) => entry?.value.step ?? "missing")),
			submitAgainstQuota: (entry: Versioned<typeof StorageRecord.Type>, limits: AdmissionLimits) => {
				story.tell(`submit ${entry.value.workId} against the observed quota`);
				return refusal(submitAgainstQuota(store, entry, limits));
			},
			workIds: (step?: string) =>
				store.list().pipe(Effect.map((entries) => entries.flatMap(({ value }) => (step === undefined || value.step === step ? [value.workId] : [])))),
		};
	},
};

export const storage = storyKit({ ...definition, around: withTestTransaction });
export const isolatedStorage = storyKit({ ...definition, around: withIsolatedDatabase });

export const snapshotStorage = storyKit({
	...definition,
	around: withIsolatedDatabase,
	layer: makePostgresTestLayer({ ...postgresOptions, maxConnections: 3 }),
});

export const timedStorage = storyKit({ ...definition, around: withTestTransaction, clock: "test" });
