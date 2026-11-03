import type { Cause } from "effect";
import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import { SqlClient, SqlSchema } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { BatchedDelete } from "#batchedDelete.ts";
import type { RepositoryChanges } from "#repositoryChanges.ts";
import type { RepositoryListFilter } from "#repositoryFilter.ts";
import type { Update, UpdateVoid } from "#repositoryUpdate.ts";
import { repositoryWrites } from "#repositoryWrites.ts";
import type { IdColumn, NativeRepository } from "#versionedRepository.ts";

export type CompositeKey<TModel extends Model.Any> = readonly [IdColumn<TModel>, IdColumn<TModel>, ...IdColumn<TModel>[]];
export type PrimaryKey<TModel extends Model.Any> = IdColumn<TModel> | CompositeKey<TModel>;
type DeleteWhere<TModel extends Model.Any> = (
	where: RepositoryListFilter<TModel>,
) => Effect.Effect<void, SqlError | Schema.SchemaError, TModel["fields"][keyof TModel["fields"]]["EncodingServices"]>;

export type Repository<TModel extends Model.Any, TId extends PrimaryKey<TModel>> = BatchedDelete<TModel> &
	([TId] extends [IdColumn<TModel>]
		? Omit<NativeRepository<TModel, Extract<TId, IdColumn<TModel>>>, "delete" | "update" | "updateVoid"> & {
				readonly delete: NativeRepository<TModel, Extract<TId, IdColumn<TModel>>>["delete"] & DeleteWhere<TModel>;
				readonly update: Update<TModel, TId extends readonly PropertyKey[] ? TId[number] : Extract<TId, PropertyKey>>;
				readonly updateVoid: UpdateVoid<TModel, TId extends readonly PropertyKey[] ? TId[number] : Extract<TId, PropertyKey>>;
			}
		: TId extends CompositeKey<TModel>
			? Omit<NativeRepository<TModel, TId[number]>, "findById" | "delete" | "update" | "updateVoid"> & {
					readonly update: Update<TModel, TId extends readonly PropertyKey[] ? TId[number] : Extract<TId, PropertyKey>>;
					readonly updateVoid: UpdateVoid<TModel, TId extends readonly PropertyKey[] ? TId[number] : Extract<TId, PropertyKey>>;
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
			: never);

export const makeCompositeCrud = Effect.fnUntraced(function* (
	model: Model.Any,
	options: {
		readonly columns: readonly string[];
		readonly tableName: string;
		readonly spanPrefix: string;
	},
	changes: RepositoryChanges,
) {
	const sql = yield* SqlClient.SqlClient;
	const { columns, tableName, spanPrefix } = options;
	const entries: [string, Schema.Constraint][] = [];
	for (const column of columns) {
		const field = model.fields[column];
		if (field === undefined) {
			return yield* Effect.die(new Error(`Unknown ID column: ${column}`));
		}
		entries.push([column, field]);
	}
	const fields = Object.fromEntries(entries);
	const Key = columns.length === 1 ? model.fields[columns[0] ?? ""] : Schema.Struct(fields);
	if (Key === undefined) {
		return yield* Effect.die(new Error("Unknown repository ID column"));
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

	return {
		...(yield* repositoryWrites(model, { ...options, idColumns: columns }, changes)),
		findById: (id: unknown) => find(id).pipe(Effect.withSpan(`${spanPrefix}.findById`)),
	};
});
