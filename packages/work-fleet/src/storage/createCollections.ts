import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable, positions } from "#storage/recordChildren.ts";
import { collections, type Shape, shapeColumns, sqlTypes } from "#storage/recordShape.ts";

export const createCollections = Effect.fn("FleetStore.createCollections")(function* (namespace: string, shape: Shape) {
	const sql = yield* SqlClient.SqlClient;
	const table = `${namespace}_records`;
	for (const collection of collections(shape)) {
		const keys = positions(collection);
		const fields = Object.entries(shapeColumns(collection.shape)).map(([name, kind]) => sql`${sql(name)} ${sql.literal(sqlTypes[kind])}`);
		yield* sql`create table ${sql(childTable(namespace, collection.path))} (
			work_id text not null references ${sql(table)} (work_id) on delete cascade,
			${sql.csv(keys.map((key) => sql`${sql(key)} integer not null check (${sql(key)} >= 0)`))},
			${sql.csv(fields)}, primary key (work_id, ${sql.csv(keys.map((key) => sql`${sql(key)}`))})
		)`;
		if (collection.path.at(-1) === "attempts") {
			yield* sql`create index on ${sql(childTable(namespace, collection.path))} (${sql("operationId")})`;
		}
	}
});
