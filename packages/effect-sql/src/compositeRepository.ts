import type { Cause } from "effect";
import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { type SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { type RepositoryChanges, repositoryChanges } from "#repositoryChanges.ts";
import type { FindManyFilter } from "#repositoryFilter.ts";
import { repositoryWrites } from "#repositoryWrites.ts";
import type { IdColumn, NativeRepository } from "#versionedRepository.ts";

export type CompositeKey<TModel extends Model.Any> = readonly [IdColumn<TModel>, IdColumn<TModel>, ...IdColumn<TModel>[]];
export type PrimaryKey<TModel extends Model.Any> = IdColumn<TModel> | CompositeKey<TModel>;
type DeleteWhere<TModel extends Model.Any> = (
	where: FindManyFilter<TModel>,
) => Effect.Effect<void, SqlError | Schema.SchemaError, TModel["fields"][keyof TModel["fields"]]["EncodingServices"]>;
export type Repository<TModel extends Model.Any, TId extends PrimaryKey<TModel>> = [TId] extends [IdColumn<TModel>]
	? Omit<NativeRepository<TModel, Extract<TId, IdColumn<TModel>>>, "delete"> & {
			readonly delete: NativeRepository<TModel, Extract<TId, IdColumn<TModel>>>["delete"] & DeleteWhere<TModel>;
		}
	: TId extends CompositeKey<TModel>
		? Omit<NativeRepository<TModel, TId[number]>, "findById" | "delete"> & {
				readonly findById: (
					id: Pick<TModel["Type"], TId[number]>,
				) => Effect.Effect<
					TModel["Type"],
					SqlError | Schema.SchemaError | Cause.NoSuchElementError,
					TModel["DecodingServices"] | TModel["fields"][TId[number]]["EncodingServices"]
				>;
				readonly delete: ((
					id: Pick<TModel["Type"], TId[number]>,
				) => Effect.Effect<void, SqlError | Schema.SchemaError, TModel["fields"][TId[number]]["EncodingServices"]>) &
					DeleteWhere<TModel>;
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
	supplied?: RepositoryChanges,
) {
	const { columns, tableName, spanPrefix } = options;
	const fields = Object.fromEntries(
		columns.map((column) => {
			const field = model.fields[column];
			if (field === undefined) {
				throw new Error(`Unknown ID column: ${column}`);
			}
			return [column, field];
		}),
	);
	const Key = columns.length === 1 ? model.fields[columns[0] ?? ""] : Schema.Struct(fields);
	if (Key === undefined) {
		throw new Error("Unknown repository ID column");
	}
	const record = Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown));
	function predicate(input: Readonly<Record<string, unknown>>) {
		return sql.and(columns.map((column) => sql`${sql(column)} = ${input[column]}`));
	}
	const find = SqlSchema.findOne({
		execute: (input) =>
			Effect.flatMap(
				record(columns.length === 1 ? { [columns[0] ?? ""]: input } : input),
				(key) => sql`select * from ${sql(tableName)} where ${predicate(key)}`,
			),
		Request: Key,
		Result: model,
	});
	const changes = supplied ?? {
		record: (rows: readonly Readonly<Record<string, unknown>>[]) =>
			Effect.flatMap(repositoryChanges(sql, tableName, columns), (boundary) => boundary.record(rows)),
		write<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return Effect.flatMap(repositoryChanges(sql, tableName, columns), (boundary) => boundary.write(effect));
		},
	};
	return {
		...repositoryWrites(model, sql, { ...options, idColumns: columns }, changes),
		findById: (id: unknown) => find(id).pipe(Effect.withSpan(`${spanPrefix}.findById`)),
	};
}
