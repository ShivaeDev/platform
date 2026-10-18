import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository, OptimisticConcurrencyError } from "@shivaedev/effect-sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { checkRecordAdmission } from "#storage/admission.ts";
import { admissionLock } from "#storage/admissionLock.ts";
import { admissionReads } from "#storage/admissionReads.ts";
import { StorageConflict } from "#storage/errors.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import { listedRecords } from "#storage/listedRecords.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { makeForeignReservations } from "#storage/makeForeignReservations.ts";
import { type AdmissionLimits, recordModel, type Versioned } from "#storage/model.ts";
import { nextAdmissionOrder } from "#storage/nextAdmissionOrder.ts";
import { operationEntries } from "#storage/operationEntries.ts";
import { readRecords } from "#storage/readRecords.ts";
import { inputColumns, makeRecordChildren } from "#storage/recordChildren.ts";
import { recordShape } from "#storage/recordShape.ts";
import { withRecordTimes } from "#storage/recordTimes.ts";
import { recordValue } from "#storage/recordValue.ts";

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
	const shape = recordShape(schema);
	const model = recordModel(schema);
	const saveChildren = yield* makeRecordChildren(namespace, shape);
	const rows = yield* makeRepository(model, { idColumn: "work_id", spanPrefix: "FleetRow", tableName: records, versionColumn: "version" });
	const foreign = yield* makeForeignReservations(namespace);
	const encodeRecord = Schema.encodeEffect(schema);
	const decodeObject = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const decodeInsert = Schema.decodeUnknownEffect(model.insert);
	const decodeRecord = Schema.decodeUnknownEffect(schema);
	function decode(row: { readonly "work_id": string; readonly version: number }) {
		return recordValue(row, shape, namespace).pipe(
			Effect.flatMap(decodeRecord),
			Effect.provideService(SqlClient.SqlClient, sql),
			Effect.map((value) => ({ value, version: row.version + 1 })),
		);
	}
	const readEntry = Effect.fn("FleetStore.readEntry")(function* (workId: string) {
		const found = yield* rows.findById(workId).pipe(Effect.catchTag("NoSuchElementError", () => Effect.succeed(undefined)));
		return found === undefined ? undefined : { order: found.admission_order, stored: yield* decode(found) };
	});
	function loadEntry(workId: string) {
		return readRecords(namespace, readEntry(workId)).pipe(Effect.provideService(SqlClient.SqlClient, sql));
	}
	function load(workId: string) {
		return loadEntry(workId).pipe(Effect.map((entry) => entry?.stored));
	}
	const readList = listedRecords(sql, schema, model, shape, namespace);
	function list() {
		return readRecords(namespace, readList()).pipe(Effect.provideService(SqlClient.SqlClient, sql));
	}
	const lock = admissionLock(namespace);
	const persist = Effect.fn("FleetStore.persist")(function* (
		workId: string,
		expectedVersion: number | null,
		record: TSchema["Type"],
		encoded: object,
		entry: { readonly order: bigint; readonly stored: Versioned<TSchema["Type"]> } | undefined,
	) {
		const requeue = entry !== undefined && options.requeue?.(record, entry.stored.value) === true;
		const input = yield* decodeInsert({ ...inputColumns(encoded, shape), "work_id": workId });
		if (entry === undefined) {
			yield* rows.insertVoid(input);
		} else {
			const order = requeue ? yield* nextAdmissionOrder(sql, records) : entry.order;
			yield* rows.updateVoid({ ...input, "admission_order": order, version: expectedVersion === null ? 0 : expectedVersion - 1 });
		}
		yield* saveChildren(workId, encoded, entry !== undefined);
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
				const external = reads.foreign ? yield* foreign.foreignReservations() : [];
				yield* checkRecordAdmission(options, record, previous?.value, entries, external, limits);
				const timed = yield* withRecordTimes(schema, encoded, previous?.value);
				return yield* persist(workId, expectedVersion, timed.value, timed.encoded, entry);
			}),
		).pipe(
			Effect.catchIf(
				(error) => error instanceof OptimisticConcurrencyError,
				() =>
					Effect.flatMap(load(workId), (actual) =>
						Effect.fail(new StorageConflict({ actualVersion: actual?.version ?? null, expectedVersion, workId })),
					),
			),
		);
	});
	return {
		compareAndSet: (workId: string, expectedVersion: number, record: TSchema["Type"], limits?: AdmissionLimits) =>
			write(workId, expectedVersion, record, limits),
		...foreign,
		hasLaunchRetry: () => rows.findMany({ select: ["launchRetry"] }).pipe(Effect.map((entries) => entries.some((row) => row.launchRetry !== null))),
		insert: (record: TSchema["Type"], limits?: AdmissionLimits) => write(record.workId, null, record, limits),
		list,
		load,
		operationEntries: (operationId: string) => operationEntries(namespace, operationId).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
	};
});
