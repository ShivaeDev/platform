import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { recordColumns, recordJson } from "#storage/model.ts";

export const legacyStore = Effect.fn("FleetFixture.legacyStore")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	const rows = yield* sql`select * from ${sql(table)} order by admission_order`;
	yield* sql`drop table ${sql(table)}`;
	yield* sql`create table ${sql(table)} (work_id text primary key, version integer not null check (version > 0), payload jsonb not null, admission_order bigint generated always as identity)`;
	for (const row of rows) {
		yield* sql`insert into ${sql(table)} (work_id, version, payload) values (${row.work_id}, ${Number(row.version) + 1}, ${yield* recordJson(row, recordColumns())}::jsonb)`;
	}
	yield* sql`delete from ${sql(`${namespace}_migrations`)} where migration_id >= 4`;
});
