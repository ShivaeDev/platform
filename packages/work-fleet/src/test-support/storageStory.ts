import { Clock, Deferred, Effect, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { CommittedSink, transact } from "@shivaedev/sql/transact.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { StorageAdmission } from "#storage/errors.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { type AdmissionLimits, recordModel, type Versioned } from "#storage/model.ts";
import { readRecordSnapshot, readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValue } from "#storage/recordValue.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { postgresEnabled, postgresLayer, postgresOptions } from "#test/postgres.ts";
import { refusal } from "#test/refusal.ts";
import { STORAGE_NAMESPACE, StorageRecord } from "#test/StorageRecord.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { makeTestStore, storageOptions, submitAgainstQuota } from "#test/storage.ts";
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
		heldSnapshotRead: Effect.fn("StorageStory.heldSnapshotRead")(function* (snapshotNamespace: string, workId: string, kind: "records" | "receipt") {
			story.tell(`a ${kind} snapshot read of ${workId} pauses after reading its root row`);
			const repository = yield* makeRepository(recordModel(), {
				idColumn: "work_id",
				spanPrefix: "Snapshot",
				tableName: `${snapshotNamespace}_records`,
			});
			const entered = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const read = Effect.gen(function* () {
				const row = yield* repository.findById(workId);
				yield* Deferred.succeed(entered, undefined);
				yield* Deferred.await(resume);
				return yield* recordValue(row, recordShape(), snapshotNamespace);
			});
			const reader = yield* (kind === "records" ? readRecords(snapshotNamespace, read) : readRecordSnapshot(read)).pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			return {
				result: () => Fiber.join(reader),
				resume: () => {
					story.tell("the paused snapshot read continues");
					return Deferred.succeed(resume, undefined);
				},
			};
		}),
		inBackground: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.forkChild(effect).pipe(Effect.map((fiber) => ({ result: () => Fiber.join(fiber) }))),
		listInsideRolledBackWrite: (entry: Versioned<typeof StorageRecord.Type>, change: Partial<typeof StorageRecord.Type>) => {
			story.tell(`list records inside a write of ${entry.value.workId} that rolls back`);
			return sql
				.withTransaction(
					store
						.compareAndSet(entry.value.workId, entry.version, { ...entry.value, ...change })
						.pipe(Effect.andThen(store.list()), Effect.andThen(Effect.fail("roll back"))),
				)
				.pipe(Effect.flip);
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
			const restarted = yield* makeTestStore(namespace);
			yield* migrateFleet(namespace);
			return restarted;
		}),
		rolledBackChanges: <A, E, R>(write: Effect.Effect<A, E, R>) => {
			story.tell("Fleet's write rolls back with its transaction");
			const changes: (readonly unknown[])[] = [];
			return transact(write.pipe(Effect.andThen(Effect.fail("rollback"))), { onSqlError: (error) => error }).pipe(
				Effect.provideService(CommittedSink, (keys) => Effect.sync(() => changes.push(keys))),
				Effect.flip,
				Effect.as(changes),
			);
		},
		secondPasses: () => {
			story.tell("a second passes");
			return TestClock.adjust("1 second");
		},
		sql,
		stepOf: (workId: string) => store.load(workId).pipe(Effect.map((entry) => entry?.value.step ?? "missing")),
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
		submitAgainstQuota: (entry: Versioned<typeof StorageRecord.Type>, limits: AdmissionLimits) => {
			story.tell(`submit ${entry.value.workId} against the observed quota`);
			return refusal(submitAgainstQuota(store, entry, limits));
		},
		workIds: (step?: string) =>
			store.list().pipe(Effect.map((entries) => entries.flatMap(({ value }) => (step === undefined || value.step === step ? [value.workId] : [])))),
		writerWaitsForSnapshot: () => {
			story.tell("the writer waits for the snapshot's lock");
			return sql<{ readonly waiting: number }>`select count(*)::integer as waiting from pg_locks
				where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database())`.pipe(
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (rows) => rows[0]?.waiting === 1 }),
				Effect.timeout("5 seconds"),
				Effect.asVoid,
			);
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
