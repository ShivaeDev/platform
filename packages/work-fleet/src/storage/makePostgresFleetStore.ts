import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { acquires, checkCapacity, checkOwnership, checkQuota, ownedPaths, validatePaths } from "#storage/admission.ts";
import { StorageConflict } from "#storage/errors.ts";
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
		readonly namespace?: string;
		readonly reservations: (record: TSchema["Type"]) => readonly string[];
		readonly owns: (record: TSchema["Type"]) => boolean;
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
		const rows = yield* sql<StoredRow>`select version, payload::text as value from ${sql(records)} order by work_id`;
		return yield* Effect.forEach(rows, decode);
	});
	const foreignReservations = Effect.fn("FleetStore.foreignReservations")(function* () {
		const rows = yield* sql`select owner, paths, executing, backlog from ${sql(foreign)} order by owner`;
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
		const paths = yield* validatePaths(options.reservations(record));
		return yield* sql.withTransaction(
			Effect.gen(function* () {
				yield* lock;
				const previous = yield* load(workId);
				const actualVersion = previous?.version ?? null;
				if (actualVersion !== expectedVersion) {
					return yield* Effect.fail(new StorageConflict({ actualVersion, expectedVersion, workId }));
				}
				const others = (yield* list()).filter(({ value }) => value.workId !== workId);
				const external = yield* foreignReservations();
				const previousPaths = ownedPaths(previous?.value, options.owns, options.reservations);
				const acquiringExecution = acquires(options.executing, record, previous?.value);
				const newlyOwned = acquiringExecution || limits.recheckOwnership === true ? paths : paths.filter((path) => !previousPaths.includes(path));
				const owners = [
					...others.filter(({ value }) => options.owns(value)).map(({ value }) => ({ owner: value.workId, paths: options.reservations(value) })),
					...external,
				];
				yield* checkOwnership(workId, options.owns(record) ? newlyOwned : [], owners);
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
				yield* sql`insert into ${sql(records)} (work_id, version, payload) values (${workId}, ${version}, ${encoded}::jsonb)
                    on conflict (work_id) do update set version = excluded.version, payload = excluded.payload`;
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
		reserveForeign: Effect.fn("FleetStore.reserveForeign")(function* (
			owner: string,
			paths: readonly string[],
			occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true },
		) {
			const valid = yield* validatePaths(paths);
			const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Array(Schema.String)))(valid);
			yield* sql.withTransaction(
				Effect.gen(function* () {
					yield* lock;
					yield* sql`insert into ${sql(foreign)} (owner, paths, executing, backlog) values (${owner}, ${encoded}::jsonb, ${occupancy.executing}, ${occupancy.backlog}) on conflict (owner) do update set paths = excluded.paths, executing = excluded.executing, backlog = excluded.backlog`;
				}),
			);
		}),
	};
});
