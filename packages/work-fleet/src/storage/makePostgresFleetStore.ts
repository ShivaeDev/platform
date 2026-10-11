import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { acquires, checkCapacity, checkQuota } from "#storage/admission.ts";
import { type StorageAdmission, StorageConflict } from "#storage/errors.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { type AdmissionLimits, ForeignReservation, type StoredRow } from "#storage/model.ts";

export const makePostgresFleetStore = Effect.fn("FleetStore.makePostgresFleetStore")(function* <
	TSchema extends Schema.Top & {
		readonly Type: { readonly workId: string };
		readonly DecodingServices: never;
		readonly EncodingServices: never;
	},
>(
	schema: TSchema,
	options: {
		readonly admission?: (
			record: TSchema["Type"],
			previous: TSchema["Type"] | undefined,
			records: readonly TSchema["Type"][],
			limits: AdmissionLimits,
		) => Effect.Effect<void, StorageAdmission>;
		readonly requeue?: (record: TSchema["Type"], previous: TSchema["Type"]) => boolean;
		readonly namespace?: string;
		readonly executing?: (record: TSchema["Type"]) => boolean;
		readonly backlog?: (record: TSchema["Type"]) => boolean;
		readonly submissions?: (record: TSchema["Type"], since: number) => number;
	},
) {
	const sql = yield* SqlClient.SqlClient;
	const namespace = options.namespace ?? "work_fleet";
	const records = `${namespace}_records`;
	const foreign = `${namespace}_foreign_reservations`;
	const JsonRecord = Schema.fromJsonString(schema);
	function decode(row: StoredRow) {
		return Schema.decodeUnknownEffect(JsonRecord)(row.value).pipe(Effect.map((value) => ({ value, version: row.version })));
	}
	const load = Effect.fn("FleetStore.load")(function* (workId: string) {
		const rows = yield* sql<StoredRow>`select version, payload::text as value from ${sql(records)} where work_id = ${workId}`;
		return rows[0] === undefined ? undefined : yield* decode(rows[0]);
	});
	const list = Effect.fn("FleetStore.list")(function* () {
		const rows = yield* sql<StoredRow>`select version, payload::text as value from ${sql(records)} order by admission_order`;
		return yield* Effect.forEach(rows, decode);
	});
	const foreignReservations = Effect.fn("FleetStore.foreignReservations")(function* () {
		const rows = yield* sql`select owner, executing, backlog from ${sql(foreign)} order by owner`;
		return yield* Schema.decodeUnknownEffect(Schema.Array(ForeignReservation))(rows);
	});
	const lock = sql`select pg_advisory_xact_lock(hashtextextended(${`work_fleet_admission:${namespace}`}, 0))`.pipe(Effect.asVoid);
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
		return yield* sql.withTransaction(
			Effect.gen(function* () {
				yield* lock;
				const previous = yield* load(workId);
				const actualVersion = previous?.version ?? null;
				if (actualVersion !== expectedVersion) {
					return yield* Effect.fail(new StorageConflict({ actualVersion, expectedVersion, workId }));
				}
				const entries = yield* list();
				yield* options.admission?.(
					record,
					previous?.value,
					entries.map(({ value }) => value),
					limits,
				) ?? Effect.void;
				const others = entries.filter(({ value }) => value.workId !== workId);
				const external = yield* foreignReservations();
				const acquiringExecution = acquires(options.executing, record, previous?.value);
				yield* checkCapacity(
					"execution",
					limits.maxExecuting,
					options.executing,
					acquiringExecution,
					others,
					external.filter((entry) => entry.executing).length,
				);
				yield* checkCapacity(
					"backlog",
					limits.maxBacklog,
					options.backlog,
					acquiringExecution || acquires(options.backlog, record, previous?.value),
					others,
					external.filter((entry) => entry.backlog).length,
				);
				yield* checkQuota(limits.quota, options.submissions, record, previous?.value, others);
				const version = (actualVersion ?? 0) + 1;
				const requeue = previous !== undefined && options.requeue?.(record, previous.value) === true;
				yield* sql`insert into ${sql(records)} (work_id, version, payload) values (${workId}, ${version}, ${encoded}::jsonb)
                    on conflict (work_id) do update set version = excluded.version, payload = excluded.payload`;
				if (requeue) {
					yield* sql`update ${sql(records)} set admission_order = default where work_id = ${workId}`;
				}
				return { value: record, version };
			}),
		);
	});
	return {
		compareAndSet: (workId: string, expectedVersion: number, record: TSchema["Type"], limits?: AdmissionLimits) =>
			write(workId, expectedVersion, record, limits),
		foreignReservations,
		initialize: () => migrateFleet(namespace),
		insert: (record: TSchema["Type"], limits?: AdmissionLimits) => write(record.workId, null, record, limits),
		list,
		load,
		releaseForeign: (owner: string) =>
			sql.withTransaction(
				Effect.gen(function* () {
					yield* lock;
					yield* sql`delete from ${sql(foreign)} where owner = ${owner}`;
				}),
			),
		reserveForeign: (owner: string, occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true }) =>
			sql.withTransaction(
				Effect.gen(function* () {
					yield* lock;
					yield* sql`insert into ${sql(foreign)} (owner, executing, backlog) values (${owner}, ${occupancy.executing}, ${occupancy.backlog}) on conflict (owner) do update set executing = excluded.executing, backlog = excluded.backlog`;
				}),
			),
	};
});
