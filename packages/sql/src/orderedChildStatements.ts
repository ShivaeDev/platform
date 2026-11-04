import { Cause, Data, Effect, Equal, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlSchema } from "effect/sql";
import type { RepositoryChanges } from "#repositoryChanges.ts";

export class ChildOrderError extends Data.TaggedError("ChildOrderError")<{
	readonly reason: "membership" | "position";
}> {}

export interface ChildOrderOptions {
	readonly idColumn: string;
	readonly parentColumn: string;
	readonly parentIdColumn: string;
	readonly parentTable: string;
	readonly positionColumn: string;
	readonly tableName: string;
}

export const orderedChildStatements = Effect.fnUntraced(function* (model: Model.Any, options: ChildOrderOptions, changes: RepositoryChanges) {
	const sql = yield* SqlClient.SqlClient;
	const { idColumn, parentColumn, parentTable, parentIdColumn, positionColumn, tableName } = options;
	const parent = model.fields[parentColumn];
	const idField = model.fields[idColumn];
	if (parent === undefined || idField === undefined) {
		return yield* Effect.die(new Error("Unknown ordered child key column"));
	}
	const encodeParent = Schema.encodeEffect(parent);
	const encodeId = Schema.encodeEffect(idField);
	const lock = Effect.fnUntraced(function* (value: unknown) {
		const encoded = yield* encodeParent(value);
		const rows = yield* sql`select ${sql(parentIdColumn)} from ${sql(parentTable)} where ${sql(parentIdColumn)} = ${encoded} for update`;
		if (rows.length === 0) {
			return yield* new Cause.NoSuchElementError();
		}
		return encoded;
	});
	const children = SqlSchema.findAll({
		execute: (encodedParent) =>
			sql`select ${sql(idColumn)} as ${sql("childId")} from ${sql(tableName)} where ${sql(parentColumn)} = ${encodedParent} order by ${sql(positionColumn)}, ${sql(idColumn)}`,
		Request: Schema.Unknown,
		Result: Schema.Struct({ childId: idField }),
	});

	const write = Effect.fnUntraced(function* (encodedParent: unknown, ids: readonly unknown[]) {
		if (ids.length === 0) {
			return;
		}
		const encoded = yield* Effect.forEach(ids, (value) => encodeId(value));
		const positions = sql.join(" ", false)(encoded.map((value, index) => sql`when ${value} then ${index}`));
		const rows = yield* sql`update ${sql(tableName)} set ${sql(positionColumn)} = case ${sql(idColumn)} ${positions} end
			where ${sql(parentColumn)} = ${encodedParent} returning ${changes.returning()}`;
		yield* changes.record(rows);
	});
	const reorder = Effect.fnUntraced(function* (value: unknown, ids: readonly unknown[]) {
		const encodedParent = yield* lock(value);
		const current = yield* children(encodedParent);
		if (ids.length !== current.length || current.some(({ childId }) => ids.filter((key) => Equal.equals(childId, key)).length !== 1)) {
			return yield* new ChildOrderError({ reason: "membership" });
		}
		yield* write(encodedParent, ids);
	});
	const move = Effect.fnUntraced(function* (value: unknown, child: unknown, position: number) {
		const encodedParent = yield* lock(value);
		const current = yield* children(encodedParent);
		if (!current.some(({ childId }) => Equal.equals(childId, child))) {
			return yield* new ChildOrderError({ reason: "membership" });
		}
		if (!Number.isInteger(position) || position < 0 || position >= current.length) {
			return yield* new ChildOrderError({ reason: "position" });
		}
		const ids = current.map(({ childId }) => childId).filter((key) => !Equal.equals(key, child));
		ids.splice(position, 0, child);
		yield* write(encodedParent, ids);
	});
	return { lock, move, reorder };
});
