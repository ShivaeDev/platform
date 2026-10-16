import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { createCollections } from "#storage/createCollections.ts";
import { legacyColumns } from "#storage/legacyColumns.ts";
import { modelFromColumns } from "#storage/model.ts";
import { inputColumns, writeChildren } from "#storage/recordChildren.ts";
import { shapeColumns, sqlTypes } from "#storage/recordShape.ts";
import { shapeV12 } from "#storage/shapeV12.ts";
import { textRecordValue } from "#storage/textRecordValue.ts";

export const typedTables = Effect.fn("FleetStore.typedTables")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	const structured = Object.entries(legacyColumns)
		.filter(([_name, kind]) => kind === "json")
		.map(([name]) => name);
	for (const name of structured) {
		yield* sql`alter table ${sql(table)} rename column ${sql(name)} to ${sql(`legacy_${name}`)}`;
	}
	const columns = shapeColumns(shapeV12);
	for (const [name, kind] of Object.entries(columns)) {
		if (!(name in legacyColumns) || structured.includes(name)) {
			yield* sql`alter table ${sql(table)} add column ${sql(name)} ${sql.literal(sqlTypes[kind])}`;
		}
	}
	yield* createCollections(namespace, shapeV12);
	const rows = yield* sql`select * from ${sql(table)} order by admission_order`;
	const model = modelFromColumns(columns);
	for (const row of rows) {
		const value = yield* textRecordValue(row, structured);
		const input = yield* Schema.decodeUnknownEffect(model.insert)({ ...inputColumns(value, shapeV12), "work_id": row.work_id });
		yield* sql`update ${sql(table)} set ${sql.update(yield* Schema.encodeEffect(model.insert)(input))} where work_id = ${row.work_id}`;
		yield* writeChildren(namespace, String(row.work_id), value, shapeV12);
	}
	for (const name of structured) {
		yield* sql`alter table ${sql(table)} drop column ${sql(`legacy_${name}`)}`;
	}
});
