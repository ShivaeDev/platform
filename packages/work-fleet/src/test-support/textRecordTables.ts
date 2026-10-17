import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { legacyColumns } from "#storage/legacyColumns.ts";
import { migrateFleet } from "#test/migrateFleet.ts";

export const textRecordTables = Effect.fn("FleetFixture.textRecordTables")(function* (namespace: string, records: readonly object[]) {
	const sql = yield* SqlClient.SqlClient;
	yield* migrateFleet(namespace, "pending_answers");
	for (const [index, record] of records.entries()) {
		const value: Record<string, unknown> = { ...record };
		const fields = Object.fromEntries(
			Object.entries(legacyColumns).map(([name, kind]) => {
				const field = value[name];
				if (field === undefined) {
					return [name, null];
				}
				return [name, kind === "json" ? JSON.stringify(field) : field];
			}),
		);
		yield* sql`insert into ${sql(`${namespace}_records`)} ${sql.insert({ ...fields, "admission_order": BigInt(index) + 9007199254740993n, version: index + 5, "work_id": value.workId })}`;
	}
});
