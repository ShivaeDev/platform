import { Effect, Option, Schema, SchemaAST, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { type InsertMany, makeInsertMany } from "#batchWrites.ts";
import type { RepositoryChanges } from "./repositoryChanges.ts";

export type InsertColumn<TModel extends Model.Any> = Extract<keyof TModel["insert"]["Type"] & keyof TModel["fields"], string>;
export type ConflictColumns<TModel extends Model.Any> = readonly [InsertColumn<TModel>, ...InsertColumn<TModel>[]];
interface UpdateOptions<TModel extends Model.Any, TExcluded extends PropertyKey> {
	readonly updateColumns: readonly [
		Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>,
		...Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>[],
	];
}
export interface ConflictWrites<TModel extends Model.Any, TExcluded extends PropertyKey> {
	readonly insertManyOrIgnore: InsertMany<TModel>;
	readonly insertOrIgnore: (
		input: TModel["insert"]["Type"],
	) => Effect.Effect<Option.Option<TModel["Type"]>, SqlError | Schema.SchemaError, TModel["insert"]["EncodingServices"] | TModel["DecodingServices"]>;
	readonly upsert: (
		input: TModel["insert"]["Type"],
		options: UpdateOptions<TModel, TExcluded>,
	) => Effect.Effect<TModel["Type"], SqlError | Schema.SchemaError, TModel["insert"]["EncodingServices"] | TModel["DecodingServices"]>;
	readonly upsertMany: (inputs: readonly TModel["insert"]["Type"][], options: UpdateOptions<TModel, TExcluded>) => ReturnType<InsertMany<TModel>>;
}

export function makeConflictWrites(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly changes: RepositoryChanges;
		readonly tableName: string;
		readonly spanPrefix: string;
		readonly conflictColumns: readonly string[];
		readonly idColumns: readonly string[];
	},
) {
	const { tableName, spanPrefix, conflictColumns, idColumns } = options;
	const encode = Schema.encodeEffect(model.insert);
	const decode = Schema.decodeUnknownEffect(model);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const updateFields = SchemaAST.isObjects(model.update.ast) ? model.update.ast.propertySignatures.map((field) => field.name) : [];
	const immutable = Object.keys(model.fields).filter((column) => !updateFields.includes(column));
	function invalid(column: string) {
		return Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([column], new SchemaIssue.UnexpectedKey(model.ast, column))));
	}
	function validateColumns(encoded: Readonly<Record<string, unknown>>, columns: readonly string[], excluded: readonly string[] = []) {
		return Effect.gen(function* () {
			if (columns.length === 0) {
				return yield* invalid("");
			}
			for (const column of columns) {
				if (!(Object.hasOwn(model.fields, column) && Object.hasOwn(encoded, column)) || excluded.includes(column)) {
					return yield* invalid(column);
				}
			}
		});
	}
	function clause(encoded: Readonly<Record<string, unknown>>, updateColumns?: readonly string[]) {
		return Effect.gen(function* () {
			yield* validateColumns(encoded, conflictColumns);
			if (updateColumns !== undefined) {
				yield* validateColumns(encoded, updateColumns, [...idColumns, ...conflictColumns, ...immutable]);
			}
			const conflict = sql.csv(conflictColumns.map((column) => sql`${sql(column)}`));
			const action =
				updateColumns === undefined
					? sql`do nothing`
					: sql`do update set ${sql.csv(updateColumns.map((column) => sql`${sql(column)} = excluded.${sql(column)}`))}`;
			return sql`on conflict (${conflict}) ${action}`;
		});
	}
	function statement(input: unknown, updateColumns?: readonly string[]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encode(input));
			const suffix = yield* clause(encoded, updateColumns);
			return sql`insert into ${sql(tableName)} ${sql.insert(encoded)} ${suffix} returning *`;
		});
	}
	return {
		insertManyOrIgnore: makeInsertMany(model, sql, options, "insertManyOrIgnore", (row) => clause(row)),
		insertOrIgnore: (input: unknown) =>
			Effect.gen(function* () {
				const rows = yield* yield* statement(input);
				yield* options.changes.record(rows);
				return rows.length === 0 ? Option.none() : Option.some(yield* decode(rows[0]));
			}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.insertOrIgnore`)),
		upsert: (input: unknown, settings: { readonly updateColumns: readonly string[] }) =>
			Effect.gen(function* () {
				const rows = yield* yield* statement(input, settings.updateColumns);
				yield* options.changes.record(rows);
				return yield* decode(rows[0]);
			}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.upsert`)),
		upsertMany: (inputs: readonly unknown[], settings: { readonly updateColumns: readonly string[] }) =>
			makeInsertMany(model, sql, options, "upsertMany", (row) => clause(row, settings.updateColumns))(inputs),
	};
}
