import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { FleetRecord } from "#model.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { childTable } from "#storage/recordChildren.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { legacyVocabulary } from "#test/legacyVocabulary.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { readDecisionRecords } from "#test/readDecisionRecords.ts";
import { makeTestStore } from "#test/storage.ts";
import { textRecordTables } from "#test/textRecordTables.ts";

function table(sql: SqlClient.SqlClient, namespace: string, suffix: string) {
	return sql(`${namespace}_${suffix}`);
}

export function byName(left: { readonly name: string }, right: { readonly name: string }) {
	return left.name.localeCompare(right.name, "en");
}

export function storageMigrationVerbs(tell: (line: string) => void) {
	function insertPayloads(namespace: string, payloads: readonly Readonly<Record<string, unknown>>[], version: (index: number) => number) {
		tell(`an earlier Fleet stored ${payloads.map(({ workId }) => String(workId)).join(", ")} as JSONB payloads in ${namespace}`);
		return SqlClient.SqlClient.pipe(
			Effect.flatMap((sql) =>
				Effect.forEach(
					payloads.entries(),
					([index, payload]) =>
						sql`insert into ${table(sql, namespace, "records")} (work_id, version, payload) values (${String(payload.workId)}, ${version(index)}, ${JSON.stringify(payload)}::jsonb)`,
					{ discard: true },
				),
			),
		);
	}
	return {
		admissionOrder: (namespace: string) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap((sql) => sql`select work_id, admission_order from ${table(sql, namespace, "records")} order by admission_order`),
			),
		appliedMigrations: (namespace: string) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql<{ readonly id: number }>`select migration_id as id from ${table(sql, namespace, "migrations")} order by migration_id`,
				),
				Effect.map((rows) => rows.map(({ id }) => id)),
			),
		childTableExists: (namespace: string, path: readonly string[]) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap((sql) => sql<{ readonly child: string | null }>`select to_regclass(${childTable(namespace, path)}) as child`),
				Effect.map((rows) => rows[0]?.child !== null),
			),
		columns: (tableName: string) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql<{ readonly name: string; readonly type: string }>`
						select attname as name, format_type(atttypid, atttypmod) as type from pg_attribute
						where attrelid = ${tableName}::regclass and attnum > 0 and not attisdropped`,
				),
				Effect.map((rows) => rows.toSorted((left, right) => left.name.localeCompare(right.name, "en"))),
			),
		forbidChildOperation: (namespace: string, path: readonly string[], operationId: string) => {
			tell(`the ${path.join(".")} child table starts refusing operation ${operationId}`);
			return SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql`alter table ${sql(childTable(namespace, path))} add check (${sql("operationId")} <> ${sql.literal(`'${operationId}'`)})`,
				),
			);
		},
		insertPayloads,
		jsonbModel: Effect.fn("StorageStory.jsonbModel")(function* (namespace: string, values: readonly FleetRecord[]) {
			tell(`an earlier Fleet kept ${values.length} records as JSONB payloads past the 2^53 admission order, with one foreign reservation`);
			yield* legacyStore(namespace);
			yield* migrateFleet(namespace, "attention_owner");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`select setval(pg_get_serial_sequence(${`${namespace}_records`}, 'admission_order'), 9007199254740993, false)`;
			yield* insertPayloads(namespace, values.map(legacyVocabulary), (index) => index + 7);
			yield* sql`insert into ${table(sql, namespace, "foreign_reservations")} (owner, executing, backlog) values ('external', false, true)`;
		}),
		migrate: (...args: Parameters<typeof migrateFleet>) => {
			tell(`migrate Fleet namespace ${args[0]}${args[1] === undefined ? "" : ` up to ${args[1]}`}`);
			return migrateFleet(...args);
		},
		migration: (...args: Parameters<typeof migrateFleet>) => {
			tell(`migrate Fleet namespace ${args[0]}`);
			return migrateFleet(...args).pipe(
				Effect.match({ onFailure: () => "failed", onSuccess: (applied) => (applied.length === 0 ? "nothing to apply" : "applied") }),
			);
		},
		openFleetStore: (options: FleetStoreOptions<FleetRecord>) => {
			tell(`open Fleet record store ${options.namespace}`);
			return makePostgresFleetStore(FleetRecord, options);
		},
		openStore: (namespace: string) => {
			tell(`reopen storage record store ${namespace}`);
			return makeTestStore(namespace);
		},
		owners: (namespace: string) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql<{
						readonly decisionOwner: string | null;
						readonly owner: string | null;
						readonly version: number;
						readonly workId: string;
					}>`select work_id as "workId", version, payload->>'attentionOwner' as owner, payload->'decision'->>'attentionOwner' as "decisionOwner"
						from ${table(sql, namespace, "records")} order by work_id`,
				),
			),
		readDecisions: (namespace: string) => {
			tell(`read stored decisions in ${namespace}`);
			return readDecisionRecords(namespace);
		},
		repairPayload: (namespace: string, workId: string, payload: object) => {
			tell(`repair the stored payload of ${workId}`);
			return SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql`update ${table(sql, namespace, "records")} set payload = ${JSON.stringify(payload)}::jsonb where work_id = ${workId}`,
				),
			);
		},
		reserveForeignRow: (namespace: string, owner: string) => {
			tell(`an earlier Fleet reserved backlog for foreign owner ${owner}`);
			return SqlClient.SqlClient.pipe(
				Effect.flatMap(
					(sql) => sql`insert into ${table(sql, namespace, "foreign_reservations")} (owner, executing, backlog) values (${owner}, false, true)`,
				),
			);
		},
		restoreLegacy: (namespace: string) => {
			tell(`restore legacy JSONB tables in ${namespace}`);
			return legacyStore(namespace);
		},
		seedTextRecords: (...args: Parameters<typeof textRecordTables>) => {
			tell(`seed legacy text records in ${args[0]}`);
			return textRecordTables(...args);
		},
		setTextField: (namespace: string, workId: string, column: string, value: string | null) => {
			tell(`set the stored ${column} text of ${workId} to ${value ?? "null"}`);
			return SqlClient.SqlClient.pipe(
				Effect.flatMap((sql) => sql`update ${table(sql, namespace, "records")} set ${sql(column)} = ${value} where work_id = ${workId}`),
			);
		},
		storedPayload: (namespace: string, workId: string) =>
			SqlClient.SqlClient.pipe(
				Effect.flatMap((sql) => sql`select version, payload from ${table(sql, namespace, "records")} where work_id = ${workId}`),
			),
		storedRows: (namespace: string) =>
			SqlClient.SqlClient.pipe(Effect.flatMap((sql) => sql`select * from ${table(sql, namespace, "records")} order by admission_order`)),
		upgradedTypedRecord: Effect.fn("StorageStory.upgradedTypedRecord")(function* (namespace: string, value: FleetRecord) {
			tell(`${value.workId} was stored before the release reason column existed, and Fleet migrates`);
			yield* migrateFleet(namespace, "decision_codes");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`insert into ${table(sql, namespace, "records")} (work_id, version, attempts, "boardRevision", cwd, preparation, prompt, stage)
				values (${value.workId}, 3, '[]', ${value.boardRevision}, ${value.cwd}, ${JSON.stringify(value.preparation)}, ${value.prompt}, ${"completed"})`;
			const store = yield* makePostgresFleetStore(FleetRecord, { namespace });
			yield* migrateFleet(namespace);
			return store;
		}),
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
