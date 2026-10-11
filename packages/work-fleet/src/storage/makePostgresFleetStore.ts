import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { checkRecordAdmission } from "#storage/admission.ts";
import { StorageConflict } from "#storage/errors.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { type AdmissionLimits, ForeignReservationRow, recordColumns, recordInput, recordJson, recordModel, type Versioned } from "#storage/model.ts";
import { nextAdmissionOrder } from "#storage/nextAdmissionOrder.ts";

export const makePostgresFleetStore = Effect.fn("FleetStore.makePostgresFleetStore")(function* <
	TSchema extends Schema.Top & {
		readonly Type: { readonly workId: string };
		readonly DecodingServices: never;
		readonly EncodingServices: never;
	},
>(schema: TSchema, options: FleetStoreOptions<TSchema["Type"]>) {
	const sql = yield* SqlClient.SqlClient;
	const namespace = options.namespace ?? "work_fleet";
	const records = `${namespace}_records`;
	const foreign = `${namespace}_foreign_reservations`;
	const JsonRecord = Schema.fromJsonString(schema);
	const columns = recordColumns(schema);
	const model = recordModel(schema);
	const rows = yield* makeRepository(model, { idColumn: "work_id", spanPrefix: "FleetRow", tableName: records, versionColumn: "version" });
	const reservations = yield* makeRepository(ForeignReservationRow, { idColumn: "owner", spanPrefix: "FleetForeign", tableName: foreign });
	function decode(row: { readonly "work_id": string; readonly version: number }) {
		return recordJson(row, columns).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(JsonRecord)),
			Effect.map((value) => ({ value, version: row.version + 1 })),
		);
	}
	const load = Effect.fn("FleetStore.load")(function* (workId: string) {
		const found = yield* rows.findMany({ where: { "work_id": workId } });
		return found[0] === undefined ? undefined : yield* decode(found[0]);
	});
	const list = Effect.fn("FleetStore.list")(function* () {
		return yield* Effect.forEach(yield* rows.findMany({ orderBy: { direction: "asc", field: "admission_order" } }), decode);
	});
	function foreignReservations() {
		return reservations.findMany({ orderBy: { direction: "asc", field: "owner" } });
	}
	const lock = sql`select pg_advisory_xact_lock(hashtextextended(${`work_fleet_admission:${namespace}`}, 0))`.pipe(Effect.asVoid);
	const persist = Effect.fn("FleetStore.persist")(function* (
		workId: string,
		expectedVersion: number | null,
		record: TSchema["Type"],
		encoded: string,
		previous: Versioned<TSchema["Type"]> | undefined,
	) {
		const requeue = previous !== undefined && options.requeue?.(record, previous.value) === true;
		const input = yield* Schema.decodeUnknownEffect(model.insert)({ ...recordInput(encoded, columns), "work_id": workId });
		if (previous === undefined) {
			yield* rows.insert(input);
		} else {
			const [original] = yield* rows.findMany({ where: { "work_id": workId } });
			if (original === undefined) {
				return yield* Effect.fail(new StorageConflict({ actualVersion: null, expectedVersion, workId }));
			}
			const order = requeue ? yield* nextAdmissionOrder(sql, records) : original.admission_order;
			yield* rows.update({ ...input, "admission_order": order, version: expectedVersion === null ? 0 : expectedVersion - 1 });
		}
		return { value: record, version: (expectedVersion ?? 0) + 1 };
	});
	const write = Effect.fn("FleetStore.write")(function* (
		workId: string,
		expectedVersion: number | null,
		record: TSchema["Type"],
		limits: AdmissionLimits = {},
	) {
		const encoded = yield* Schema.encodeEffect(JsonRecord)(record);
		if (record.workId !== workId) {
			return yield* Effect.fail(new StorageConflict({ actualVersion: null, expectedVersion, workId }));
		}
		return yield* sql
			.withTransaction(
				Effect.gen(function* () {
					yield* lock;
					const previous = yield* load(workId);
					const actualVersion = previous?.version ?? null;
					if (actualVersion !== expectedVersion) {
						return yield* Effect.fail(new StorageConflict({ actualVersion, expectedVersion, workId }));
					}
					const entries = yield* list();
					yield* checkRecordAdmission(options, record, previous?.value, entries, yield* foreignReservations(), limits);
					return yield* persist(workId, expectedVersion, record, encoded, previous);
				}),
			)
			.pipe(
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
		initialize: () => migrateFleet(namespace, schema),
		insert: (record: TSchema["Type"], limits?: AdmissionLimits) => write(record.workId, null, record, limits),
		list,
		load,
		releaseForeign: (owner: string) =>
			sql.withTransaction(
				Effect.gen(function* () {
					yield* lock;
					yield* reservations.delete(owner);
				}),
			),
		reserveForeign: (owner: string, occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true }) =>
			sql.withTransaction(
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
