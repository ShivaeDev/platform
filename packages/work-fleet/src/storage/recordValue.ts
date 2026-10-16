import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { childTable, objectValue } from "#storage/recordChildren.ts";
import { collections, type Shape } from "#storage/recordShape.ts";

type Row = Readonly<Record<string, unknown>>;

export const recordValues = Effect.fn("FleetRow.recordValues")(function* (rows: readonly object[], shape: Shape, namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const roots = rows.map(objectValue);
	const children = new Map<string, readonly Row[]>();
	if (roots.length === 0) {
		return [];
	}
	for (const collection of collections(shape)) {
		const found = yield* sql<Row>`select * from ${sql(childTable(namespace, collection.path))} where ${sql.in(
			"work_id",
			roots.map((row) => row.work_id),
		)} order by ${sql.csv(Array.from({ length: collection.parents.length + 1 }, (_unused, index) => sql`${sql(`position${index}`)}`))}`;
		children.set(collection.path.join("."), found);
	}
	function read(node: Shape, row: Row, path: readonly string[], prefix: readonly string[], indices: readonly number[]): unknown {
		const name = prefix.join("__");
		if (typeof node === "string") {
			return row[name] ?? undefined;
		}
		if (prefix.length > 0 && (row[name] === null || row[name] === undefined)) {
			return undefined;
		}
		if ("fields" in node) {
			return Object.fromEntries(
				Object.entries(node.fields)
					.map(([key, field]) => [key, read(field, row, [...path, key], [...prefix, key], indices)])
					.filter(([_key, value]) => value !== undefined),
			);
		}
		if (typeof node.array === "string") {
			return row[name];
		}
		return (children.get(path.join(".")) ?? [])
			.filter((child) => child.work_id === row.work_id && indices.every((position, index) => child[`position${index}`] === position))
			.map((child) => read(node.array, child, path, [], [...indices, Number(child[`position${indices.length}`])]));
	}
	return roots.map((row) => ({ ...objectValue(read(shape, row, [], [], [])), workId: row.work_id }));
});

export function recordValue(row: object, shape: Shape, namespace: string) {
	return recordValues([row], shape, namespace).pipe(Effect.map(([value]) => value));
}
