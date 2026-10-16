import { createHash } from "node:crypto";
import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { type Collection, collections, columnSchema, type Shape, shapeColumns } from "#storage/recordShape.ts";

export function childTable(namespace: string, path: readonly string[]) {
	return `${namespace}_c_${createHash("sha256").update(path.join(".")).digest("hex").slice(0, 12)}`;
}

export function positions(collection: Collection) {
	return Array.from({ length: collection.parents.length + 1 }, (_unused, index) => `position${index}`);
}

export function childModel(collection: Collection) {
	class Child extends Model.Class<Child>("FleetChild")({
		...Object.fromEntries(Object.entries(shapeColumns(collection.shape)).map(([name, kind]) => [name, columnSchema(kind)])),
		...Object.fromEntries(positions(collection).map((name) => [name, Schema.Number])),
		"work_id": Schema.String,
	}) {}
	return Child;
}

export function objectValue(value: unknown): Record<string, unknown> {
	return Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(value);
}

function presence(value: unknown) {
	return value === undefined ? null : true;
}

export function inputColumns(value: unknown, shape: Shape, path: readonly string[] = []): Record<string, unknown> {
	const name = path.join("__");
	if (typeof shape === "string") {
		return { [name]: value ?? null };
	}
	if ("array" in shape) {
		const stored = typeof shape.array === "string" ? (value ?? null) : presence(value);
		return { [name]: stored };
	}
	const fields = value === undefined ? {} : objectValue(value);
	return Object.assign(
		path.length === 0 ? {} : { [name]: presence(value) },
		...Object.entries(shape.fields).map(([key, field]) => inputColumns(fields[key], field, [...path, key])),
	);
}

export const writeChildren = Effect.fn("FleetRow.writeChildren")(function* (namespace: string, workId: string, value: unknown, shape: Shape) {
	const sql = yield* SqlClient.SqlClient;
	const tables = collections(shape);
	for (const collection of [...tables].reverse()) {
		yield* sql`delete from ${sql(childTable(namespace, collection.path))} where work_id = ${workId}`;
	}
	function write(
		current: unknown,
		node: Shape,
		path: readonly string[],
		indices: readonly number[],
	): Effect.Effect<void, Schema.SchemaError | SqlError, SqlClient.SqlClient> {
		return Effect.gen(function* () {
			if (current === undefined) {
				return;
			}
			if (typeof node === "string") {
				return;
			}
			if ("fields" in node) {
				const fields = objectValue(current);
				yield* Effect.forEach(Object.entries(node.fields), ([name, field]) => write(fields[name], field, [...path, name], indices), {
					discard: true,
				});
				return;
			}
			if (typeof node.array === "string") {
				return;
			}
			yield* writeArray(current, node.array, path, indices);
		});
	}
	function writeArray(
		current: unknown,
		item: Shape,
		path: readonly string[],
		indices: readonly number[],
	): Effect.Effect<void, Schema.SchemaError | SqlError, SqlClient.SqlClient> {
		return Effect.gen(function* () {
			const collection = tables.find((table) => table.path.join(".") === path.join("."));
			if (collection === undefined) {
				return yield* Effect.die("Missing Fleet collection");
			}
			const model = childModel(collection);
			const repository = yield* makeRepository(model, { idColumn: "work_id", spanPrefix: "FleetChild", tableName: childTable(namespace, path) });
			const entries = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Unknown))(current);
			for (const [index, entry] of entries.entries()) {
				const keys = [...indices, index];
				const input = yield* Schema.decodeUnknownEffect(model.insert)({
					...inputColumns(entry, item),
					...Object.fromEntries(keys.map((position, depth) => [`position${depth}`, position])),
					"work_id": workId,
				});
				yield* repository.insertVoid(input);
				yield* write(entry, item, path, keys);
			}
		});
	}

	yield* write(value, shape, [], []);
});
