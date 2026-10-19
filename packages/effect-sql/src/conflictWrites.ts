import { Effect, Option, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { type InsertMany, makeInsertMany } from "#batchWrites.ts";
import { type InsertFromSelect, makeInsertFromSelect } from "#insertFromSelect.ts";
import { makeConflictClause } from "#makeConflictClause.ts";
import type { RepositoryChanges } from "./repositoryChanges.ts";

export type InsertColumn<TModel extends Model.Any> = Extract<keyof TModel["insert"]["Type"] & keyof TModel["fields"], string>;
export type ConflictColumns<TModel extends Model.Any> = readonly [InsertColumn<TModel>, ...InsertColumn<TModel>[]];
interface UpdateOptions<TModel extends Model.Any, TExcluded extends PropertyKey> {
	readonly updateColumns: readonly [
		Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>,
		...Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>[],
	];
}
export interface ConflictWrites<TModel extends Model.Any, TExcluded extends PropertyKey, TFilterServices = never> {
	readonly insertFromSelectOrIgnore: InsertFromSelect<TModel, TFilterServices>;
	readonly insertManyOrIgnore: InsertMany<TModel, TFilterServices>;
	readonly insertOrIgnore: (
		input: TModel["insert"]["Type"],
	) => Effect.Effect<
		Option.Option<TModel["Type"]>,
		SqlError | Schema.SchemaError,
		TModel["insert"]["EncodingServices"] | TModel["DecodingServices"] | TFilterServices
	>;
	readonly upsert: (
		input: TModel["insert"]["Type"],
		options: UpdateOptions<TModel, TExcluded>,
	) => Effect.Effect<
		TModel["Type"],
		SqlError | Schema.SchemaError,
		TModel["insert"]["EncodingServices"] | TModel["DecodingServices"] | TFilterServices
	>;
	readonly upsertMany: (
		inputs: readonly TModel["insert"]["Type"][],
		options: UpdateOptions<TModel, TExcluded>,
	) => ReturnType<InsertMany<TModel, TFilterServices>>;
}

export function makeConflictWrites(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly changes: RepositoryChanges;
		readonly tableName: string;
		readonly spanPrefix: string;
		readonly conflictColumns: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
		readonly idColumns: readonly string[];
	},
) {
	const { tableName, spanPrefix } = options;
	const encode = Schema.encodeEffect(model.insert);
	const decode = Schema.decodeUnknownEffect(model);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const clause = makeConflictClause(model, sql, options);
	function statement(input: unknown, updateColumns?: readonly string[]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encode(input));
			const suffix = yield* clause(encoded, updateColumns);
			return sql`insert into ${sql(tableName)} ${sql.insert(encoded)} ${suffix} returning *`;
		});
	}
	return {
		insertFromSelectOrIgnore: makeInsertFromSelect(model, sql, options, "insertFromSelectOrIgnore", (columns) =>
			clause(Object.fromEntries(columns.map((key) => [key, undefined]))),
		),
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
