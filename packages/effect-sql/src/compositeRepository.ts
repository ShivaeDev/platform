import type { Cause } from "effect";
import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { type SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { IdColumn, NativeRepository } from "#versionedRepository.ts";

export type CompositeKey<TModel extends Model.Any> = readonly [IdColumn<TModel>, IdColumn<TModel>, ...IdColumn<TModel>[]];
export type PrimaryKey<TModel extends Model.Any> = IdColumn<TModel> | CompositeKey<TModel>;
export type Repository<TModel extends Model.Any, TId extends PrimaryKey<TModel>> =
	TId extends IdColumn<TModel>
		? NativeRepository<TModel, TId>
		: TId extends CompositeKey<TModel>
			? Omit<NativeRepository<TModel, TId[number]>, "findById" | "delete"> & {
					readonly findById: (
						id: Pick<TModel["Type"], TId[number]>,
					) => Effect.Effect<
						TModel["Type"],
						SqlError | Schema.SchemaError | Cause.NoSuchElementError,
						TModel["DecodingServices"] | TModel["fields"][TId[number]]["EncodingServices"]
					>;
					readonly delete: (
						id: Pick<TModel["Type"], TId[number]>,
					) => Effect.Effect<void, SqlError | Schema.SchemaError, TModel["fields"][TId[number]]["EncodingServices"]>;
				}
			: never;

export function makeCompositeCrud(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: {
		readonly columns: readonly string[];
		readonly tableName: string;
		readonly spanPrefix: string;
	},
) {
	const { columns, tableName, spanPrefix } = options;
	const Key = Schema.Struct(
		Object.fromEntries(
			columns.map((column) => {
				const field = model.fields[column];
				if (field === undefined) {
					throw new Error(`Unknown ID column: ${column}`);
				}
				return [column, field];
			}),
		),
	);
	const Record = Schema.Record(Schema.String, Schema.Unknown);
	function predicate(input: Readonly<Record<string, unknown>>) {
		return sql.and(columns.map((column) => sql`${sql(column)} = ${input[column]}`));
	}
	const find = SqlSchema.findOne({
		execute: (input) => sql`select * from ${sql(tableName)} where ${predicate(input)}`,
		Request: Key,
		Result: model,
	});
	const remove = SqlSchema.void({
		execute: (input) => sql`delete from ${sql(tableName)} where ${predicate(input)}`,
		Request: Key,
	});
	const updateRows = SqlSchema.findOne({
		execute: (input) =>
			Effect.flatMap(
				Schema.decodeUnknownEffect(Record)(input),
				(encoded) => sql`update ${sql(tableName)} set ${sql.update(encoded, columns)} where ${predicate(encoded)} returning *`,
			),
		Request: model.update,
		Result: model,
	});
	const updateVoidRows = SqlSchema.void({
		execute: (input) =>
			Effect.flatMap(
				Schema.decodeUnknownEffect(Record)(input),
				(encoded) => sql`update ${sql(tableName)} set ${sql.update(encoded, columns)} where ${predicate(encoded)}`,
			),
		Request: model.update,
	});
	return {
		delete: (id: Readonly<Record<string, unknown>>) => remove(id).pipe(Effect.withSpan(`${spanPrefix}.delete`)),
		findById: (id: Readonly<Record<string, unknown>>) => find(id).pipe(Effect.withSpan(`${spanPrefix}.findById`)),
		update: (input: unknown) => updateRows(input).pipe(Effect.catchTag("NoSuchElementError", Effect.die), Effect.withSpan(`${spanPrefix}.update`)),
		updateVoid: (input: unknown) => updateVoidRows(input).pipe(Effect.withSpan(`${spanPrefix}.updateVoid`)),
	};
}
