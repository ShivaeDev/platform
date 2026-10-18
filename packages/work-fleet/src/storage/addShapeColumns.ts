import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable } from "#storage/recordChildren.ts";
import { collections, type Shape, shapeColumns, sqlTypes } from "#storage/recordShape.ts";

export const addShapeColumns = Effect.fn("FleetStore.addShapeColumns")(function* (namespace: string, before: Shape, after: Shape) {
	const sql = yield* SqlClient.SqlClient;
	const existing = new Map(collections(before).map((collection) => [collection.path.join("."), shapeColumns(collection.shape)]));
	const tables = [
		{ columns: shapeColumns(after), existing: shapeColumns(before), table: `${namespace}_records` },
		...collections(after).map((collection) => ({
			columns: shapeColumns(collection.shape),
			existing: existing.get(collection.path.join(".")) ?? {},
			table: childTable(namespace, collection.path),
		})),
	];
	for (const { columns, existing: present, table } of tables) {
		for (const [name, kind] of Object.entries(columns)) {
			if (!(name in present)) {
				yield* sql`alter table ${sql(table)} add column ${sql(name)} ${sql.literal(sqlTypes[kind])}`;
			}
		}
	}
});
