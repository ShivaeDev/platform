import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { type SqlClient, SqlSchema } from "effect/sql";
import type { RepositoryChanges } from "./repositoryChanges.ts";
import { makeFilter } from "./repositoryFilter.ts";

export function repositoryWrites(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: { readonly idColumns: readonly string[]; readonly tableName: string; readonly spanPrefix: string },
	changes: RepositoryChanges,
) {
	const { idColumns, tableName, spanPrefix } = options;
	const { where } = makeFilter(model, sql);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const filterRecord = Schema.decodeUnknownEffect(Schema.Record(Schema.PropertyKey, Schema.Unknown));
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
	const idColumn = idColumns[0] ?? "";
	const key = model.fields[idColumn];
	if (key === undefined) {
		throw new Error("Unknown repository ID column");
	}
	const isKey = Schema.is(key);
	const removeByKey = SqlSchema.void({
		execute: (id) =>
			Effect.flatMap(record({ [idColumn]: id }), (encoded) =>
				sql`delete from ${sql(tableName)} where ${predicate(encoded)} returning *`.pipe(Effect.tap(changes.record)),
			),
		Request: key,
	});
	function remove(input: unknown) {
		return idColumns.length === 1 && isKey(input)
			? removeByKey(input)
			: Effect.flatMap(filterRecord(input), (filter) =>
					Effect.flatMap(where(filter, true), (clause) =>
						sql`delete from ${sql(tableName)} where ${clause} returning *`.pipe(Effect.tap(changes.record), Effect.asVoid),
					),
				);
	}
	return {
		delete: (id: unknown) => changes.write(remove(id)).pipe(Effect.withSpan(`${spanPrefix}.delete`)),
		insert: (input: unknown) =>
			changes.write(insertRow(input).pipe(Effect.catchTag("NoSuchElementError", Effect.die))).pipe(Effect.withSpan(`${spanPrefix}.insert`)),
		insertVoid: (input: unknown) => changes.write(insertVoid(input)).pipe(Effect.withSpan(`${spanPrefix}.insertVoid`)),
		update: (input: unknown, settings?: { readonly onMissing: "fail" }) =>
			changes
				.write(settings?.onMissing === "fail" ? updateRow(input) : updateRow(input).pipe(Effect.catchTag("NoSuchElementError", Effect.die)))
				.pipe(Effect.withSpan(`${spanPrefix}.update`)),
		updateVoid: (input: unknown) => changes.write(updateVoid(input)).pipe(Effect.withSpan(`${spanPrefix}.updateVoid`)),
	};
}
