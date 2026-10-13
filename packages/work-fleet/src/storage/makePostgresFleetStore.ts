import { Effect, Array as EffectArray, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { checkRecordAdmission } from "#storage/admission.ts";
import { admissionReads } from "#storage/admissionReads.ts";
import { StorageConflict } from "#storage/errors.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { type AdmissionLimits, ForeignReservationRow, recordColumns, recordInput, recordModel, type Versioned } from "#storage/model.ts";
import { nextAdmissionOrder } from "#storage/nextAdmissionOrder.ts";
import { operationEntries } from "#storage/operationEntries.ts";
import { recordValue, recordValues } from "#storage/recordValue.ts";

export const makePostgresFleetStore = Effect.fn("FleetStore.makePostgresFleetStore")(function* <
	TSchema extends Schema.Top & {
		readonly Type: { readonly workId: string };
		readonly DecodingServices: never;
		readonly EncodingServices: never;
	},
>(schema: TSchema, options: FleetStoreOptions<TSchema["Type"]>) {
	const sql = yield* SqlClient.SqlClient;
	const namespace = options.namespace ?? "work_fleet";
	const commit = yield* makeFleetTransaction;
	const records = `${namespace}_records`;
	const foreign = `${namespace}_foreign_reservations`;
	const columns = recordColumns(schema);
	const model = recordModel(schema);
	const rows = yield* makeRepository(model, { idColumn: "work_id", spanPrefix: "FleetRow", tableName: records, versionColumn: "version" });
	const reservations = yield* makeRepository(ForeignReservationRow, { idColumn: "owner", spanPrefix: "FleetForeign", tableName: foreign });
	const encodeRecord = Schema.encodeEffect(schema);
	const decodeObject = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const decodeInsert = Schema.decodeUnknownEffect(model.insert);
	const decodeRecord = Schema.decodeUnknownEffect(schema);
	const decodeRecords = Schema.decodeUnknownEffect(Schema.Array(schema));
	function decode(row: { readonly "work_id": string; readonly version: number }) {
		return recordValue(row, columns).pipe(
			Effect.flatMap(decodeRecord),
			Effect.map((value) => ({ value, version: row.version + 1 })),
		);
	}
	const loadEntry = Effect.fn("FleetStore.loadEntry")(function* (workId: string) {
		const found = yield* rows.findById(workId).pipe(Effect.catchTag("NoSuchElementError", () => Effect.succeed(undefined)));
		return found === undefined ? undefined : { order: found.admission_order, stored: yield* decode(found) };
	});
	function load(workId: string) {
		return loadEntry(workId).pipe(Effect.map((entry) => entry?.stored));
	}
	const list = Effect.fn("FleetStore.list")(function* () {
		const found = yield* rows.findMany({ orderBy: { direction: "asc", field: "admission_order" } });
		const values = yield* decodeRecords(yield* recordValues(found, columns));
		return EffectArray.zipWith(values, found, (value, row) => ({ value, version: row.version + 1 }));
	});
	function foreignReservations() {
		return reservations.findMany({ orderBy: { direction: "asc", field: "owner" } });
	}
	const lock = sql`select pg_advisory_xact_lock(hashtextextended(${`work_fleet_admission:${namespace}`}, 0))`.pipe(Effect.asVoid);
	const persist = Effect.fn("FleetStore.persist")(function* (
		workId: string,
		expectedVersion: number | null,
		record: TSchema["Type"],
		encoded: object,
		entry: { readonly order: bigint; readonly stored: Versioned<TSchema["Type"]> } | undefined,
	) {
		const requeue = entry !== undefined && options.requeue?.(record, entry.stored.value) === true;
		const input = yield* decodeInsert({ ...recordInput(encoded, columns), "work_id": workId });
		if (entry === undefined) {
			yield* rows.insertVoid(input);
		} else {
			const order = requeue ? yield* nextAdmissionOrder(sql, records) : entry.order;
			yield* rows.updateVoid({ ...input, "admission_order": order, version: expectedVersion === null ? 0 : expectedVersion - 1 });
		}
		return { value: record, version: (expectedVersion ?? 0) + 1 };
	});
	const write = Effect.fn("FleetStore.write")(function* (
		workId: string,
		expectedVersion: number | null,
		record: TSchema["Type"],
		limits: AdmissionLimits = {},
	) {
		const encoded = yield* decodeObject(yield* encodeRecord(record));
		if (record.workId !== workId) {
			return yield* Effect.fail(new StorageConflict({ actualVersion: null, expectedVersion, workId }));
		}
		return yield* commit(
			[fleetRecords.item(workId), fleetRecords.list],
			Effect.gen(function* () {
				yield* lock;
				const entry = yield* loadEntry(workId);
				const previous = entry?.stored;
				const actualVersion = previous?.version ?? null;
				if (actualVersion !== expectedVersion) {
					return yield* Effect.fail(new StorageConflict({ actualVersion, expectedVersion, workId }));
				}
				const reads = admissionReads(options, record, previous?.value, limits);
				const entries = reads.records ? yield* list() : [];
				const external = reads.foreign ? yield* foreignReservations() : [];
				yield* checkRecordAdmission(options, record, previous?.value, entries, external, limits);
				return yield* persist(workId, expectedVersion, record, encoded, entry);
			}),
		).pipe(
			Effect.catchTag("OptimisticConcurrencyError", () =>
				Effect.flatMap(load(workId), (actual) =>
					Effect.fail(new StorageConflict({ actualVersion: actual?.version ?? null, expectedVersion, workId })),
				),
			),
		);
	});
	return {
		compareAndSet: (workId: string, expectedVersion: number, record: TSchema["Type"], limits?: AdmissionLimits) =>
			write(workId, expectedVersion, record, limits),
		foreignReservations,
		hasLaunchRetry: () => rows.findMany({ select: ["launchRetry"] }).pipe(Effect.map((entries) => entries.some((row) => row.launchRetry !== null))),
		initialize: () => commit([fleetRecords.list], migrateFleet(namespace)),
		insert: (record: TSchema["Type"], limits?: AdmissionLimits) => write(record.workId, null, record, limits),
		list,
		load,
		operationEntries: (operationId: string) =>
			rows
				.findMany({ select: ["work_id", "version", "attempts", "history"] })
				.pipe(Effect.flatMap((entries) => operationEntries(entries, operationId))),
		releaseForeign: (owner: string) =>
			commit(
				[fleetRecords.list],
				Effect.gen(function* () {
					yield* lock;
					yield* reservations.delete(owner);
				}),
			),
		reserveForeign: (owner: string, occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true }) =>
			commit(
				[fleetRecords.list],
				Effect.gen(function* () {
					yield* lock;
					const existing = yield* reservations.findMany({ where: { owner } });
					if (existing.length === 0) {
						yield* reservations.insertVoid({ owner, ...occupancy });
					} else {
						yield* reservations.updateVoid({ owner, ...occupancy });
					}
				}),
			),
	};
});
