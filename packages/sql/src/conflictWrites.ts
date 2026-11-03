import { Effect, Option, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { type InsertMany, makeInsertMany } from "#batchWrites.ts";
import { type ConditionalUpsert, type ConditionalUpsertMany, makeConditionalUpsert } from "#conditionalUpsert.ts";
import { type InsertFromSelect, makeInsertFromSelect } from "#insertFromSelect.ts";
import { makeConflictClause } from "#makeConflictClause.ts";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import type { UpsertAssignment, UpsertColumn } from "#upsertColumns.ts";
import { makeUpsertDecoder, upsertReturning } from "#upsertResult.ts";

export type InsertColumn<TModel extends Model.Any> = Extract<keyof TModel["insert"]["Type"] & keyof TModel["fields"], string>;
export type ConflictColumns<TModel extends Model.Any> = readonly [InsertColumn<TModel>, ...InsertColumn<TModel>[]];
interface UpdateOptions<TModel extends Model.Any, TExcluded extends PropertyKey> {
	readonly updateColumns: readonly [
		UpsertColumn<TModel, Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>>,
		...UpsertColumn<TModel, Exclude<InsertColumn<TModel> & keyof TModel["update"]["Type"], TExcluded>>[],
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
	readonly upsert: ConditionalUpsert<
		TModel,
		UpdateOptions<TModel, TExcluded>,
		TModel["insert"]["EncodingServices"] | TModel["DecodingServices"] | TFilterServices
	>;
	readonly upsertMany: ConditionalUpsertMany<
		TModel,
		UpdateOptions<TModel, TExcluded>,
		TModel["insert"]["EncodingServices"] | TModel["DecodingServices"] | TFilterServices
	>;
}

export const makeConflictWrites = Effect.fnUntraced(function* (
	model: Model.Any,
	options: {
		readonly changes: RepositoryChanges;
		readonly tableName: string;
		readonly spanPrefix: string;
		readonly conflictColumns: readonly string[];
		readonly conflictWhere?: Readonly<Record<string, unknown>>;
		readonly idColumns: readonly string[];
	},
) {
	const sql = yield* SqlClient.SqlClient;
	const { tableName, spanPrefix } = options;
	const returning = yield* upsertReturning();
	const encode = Schema.encodeEffect(model.insert);
	const decode = Schema.decodeUnknownEffect(model);
	const decodeUpsert = makeUpsertDecoder(model);
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	const conditional = yield* makeConditionalUpsert(model, options);
	const clause = yield* makeConflictClause(model, options);
	function statement(input: unknown, updateColumns?: readonly UpsertAssignment[]) {
		return Effect.gen(function* () {
			const encoded = yield* record(yield* encode(input));
			const suffix = yield* clause(encoded, updateColumns);
			return sql`insert into ${sql(tableName)} ${sql.insert(encoded)} ${suffix} returning ${options.changes.returning(updateColumns === undefined ? sql`*` : returning)}`;
		});
	}
	return {
		insertFromSelectOrIgnore: yield* makeInsertFromSelect(model, options, "insertFromSelectOrIgnore", (columns) =>
			clause(Object.fromEntries(columns.map((key) => [key, undefined]))),
		),
		insertManyOrIgnore: yield* makeInsertMany(model, options, "insertManyOrIgnore", (row) => clause(row)),
		insertOrIgnore: (input: unknown) =>
			Effect.gen(function* () {
				const rows = yield* yield* statement(input);
				yield* options.changes.record(rows);
				return rows.length === 0 ? Option.none() : Option.some(yield* decode(rows[0]));
			}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.insertOrIgnore`)),
		upsert: (
			input: unknown,
			settings: { readonly updateColumns: readonly UpsertAssignment[]; readonly updateWhere?: Readonly<Record<string, unknown>> },
		) =>
			settings.updateWhere === undefined
				? Effect.gen(function* () {
						const rows = yield* yield* statement(input, settings.updateColumns);
						yield* options.changes.record(rows);
						return yield* decodeUpsert(rows[0]);
					}).pipe(options.changes.write, Effect.withSpan(`${spanPrefix}.upsert`))
				: conditional([input], { ...settings, updateWhere: settings.updateWhere }).pipe(Effect.map((results) => results[0])),
		upsertMany: (
			inputs: readonly unknown[],
			settings: { readonly updateColumns: readonly UpsertAssignment[]; readonly updateWhere?: Readonly<Record<string, unknown>> },
		) =>
			settings.updateWhere === undefined
				? Effect.flatMap(
						makeInsertMany(model, options, "upsertMany", (row) => clause(row, settings.updateColumns), true),
						(insertMany) => insertMany(inputs),
					).pipe(Effect.provideService(SqlClient.SqlClient, sql))
				: conditional(inputs, { ...settings, updateWhere: settings.updateWhere }),
	};
});
