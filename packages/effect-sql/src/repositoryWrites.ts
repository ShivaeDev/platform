import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { type SqlClient, SqlSchema } from "effect/sql";
import type { RepositoryChanges } from "./repositoryChanges.ts";

export function repositoryWrites(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: { readonly idColumns: readonly string[]; readonly tableName: string; readonly spanPrefix: string },
	changes: RepositoryChanges,
) {
	const { idColumns, tableName, spanPrefix } = options;
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	function predicate(input: Readonly<Record<string, unknown>>) {
		return sql.and(idColumns.map((column) => sql`${sql(column)} = ${input[column]}`));
	}
	function insert(input: unknown) {
		return Effect.flatMap(record(input), (row) =>
			(Object.keys(row).length === 0
				? sql`insert into ${sql(tableName)} default values returning *`
				: sql`insert into ${sql(tableName)} ${sql.insert(row)} returning *`
			).pipe(Effect.tap(changes.record)),
		);
	}
	function update(input: unknown) {
		return Effect.flatMap(record(input), (row) =>
			sql`update ${sql(tableName)} set ${sql.update(row, idColumns)} where ${predicate(row)} returning *`.pipe(Effect.tap(changes.record)),
		);
	}
	const insertRow = SqlSchema.findOne({ execute: insert, Request: model.insert, Result: model });
	const insertVoid = SqlSchema.void({ execute: insert, Request: model.insert });
	const updateRow = SqlSchema.findOne({ execute: update, Request: model.update, Result: model });
	const updateVoid = SqlSchema.void({ execute: update, Request: model.update });
	const fields = Object.fromEntries(
		idColumns.map((column) => {
			const field = model.fields[column];
			if (field === undefined) {
				throw new Error(`Unknown ID column: ${column}`);
			}
			return [column, field];
		}),
	);
	const key = idColumns.length === 1 ? model.fields[idColumns[0] ?? ""] : Schema.Struct(fields);
	if (key === undefined) {
		throw new Error("Unknown repository ID column");
	}
	const remove = SqlSchema.void({
		execute: (id) => {
			const row = idColumns.length === 1 ? { [idColumns[0] ?? ""]: id } : id;
			return Effect.flatMap(record(row), (encoded) =>
				sql`delete from ${sql(tableName)} where ${predicate(encoded)} returning *`.pipe(Effect.tap(changes.record)),
			);
		},
		Request: key,
	});
	return {
		delete: (id: unknown) => changes.write(remove(id)).pipe(Effect.withSpan(`${spanPrefix}.delete`)),
		insert: (input: unknown) =>
			changes.write(insertRow(input).pipe(Effect.catchTag("NoSuchElementError", Effect.die))).pipe(Effect.withSpan(`${spanPrefix}.insert`)),
		insertVoid: (input: unknown) => changes.write(insertVoid(input)).pipe(Effect.withSpan(`${spanPrefix}.insertVoid`)),
		update: (input: unknown) =>
			changes.write(updateRow(input).pipe(Effect.catchTag("NoSuchElementError", Effect.die))).pipe(Effect.withSpan(`${spanPrefix}.update`)),
		updateVoid: (input: unknown) => changes.write(updateVoid(input)).pipe(Effect.withSpan(`${spanPrefix}.updateVoid`)),
	};
}
