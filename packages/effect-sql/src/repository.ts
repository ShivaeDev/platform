import { Data, Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/unstable/schema";
import { SqlClient, SqlModel } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { type IdColumn, makeVersionedWrites, type NativeRepository, type VersionColumn, type VersionedWrites } from "#versionedRepository.ts";

export class OptimisticConcurrencyError extends Data.TaggedError("OptimisticConcurrencyError")<{
	readonly tableName: string;
	readonly id: unknown;
	readonly expectedVersion: number;
}> {}

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

export interface FindMany<TModel extends Model.Any, TKey extends Key<TModel>> {
	readonly limit?: number;
	readonly orderBy?: {
		readonly field: Key<TModel>;
		readonly direction: "asc" | "desc";
	};
	readonly select?: readonly [TKey, ...TKey[]];
	readonly where?: { readonly [TField in keyof Row<TModel>]?: Row<TModel>[TField] | undefined };
}

const Limit = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

interface RepositoryOptions<TId> {
	readonly idColumn: TId;
	readonly spanPrefix: string;
	readonly tableName: string;
}
interface Queries<TModel extends Model.Any> {
	findMany: <TKey extends Key<TModel> = Key<TModel>>(
		query?: FindMany<TModel, TKey>,
	) => Effect.Effect<
		Pick<Row<TModel>, TKey>[],
		SqlError | Schema.SchemaError,
		TModel["fields"][Key<TModel>]["EncodingServices"] | TModel["fields"][TKey]["DecodingServices"]
	>;
}

export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn: VersionColumn<TModel, TId> },
): Effect.Effect<
	Omit<NativeRepository<TModel, TId>, keyof VersionedWrites<TModel, TId>> & VersionedWrites<TModel, TId> & Queries<TModel>,
	never,
	SqlClient.SqlClient
>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: never },
): Effect.Effect<NativeRepository<TModel, TId> & Queries<TModel>, never, SqlClient.SqlClient>;
export function makeRepository<TModel extends Model.Any, TId extends IdColumn<TModel>>(
	model: TModel,
	options: RepositoryOptions<TId> & { readonly versionColumn?: string },
): Effect.Effect<unknown, never, SqlClient.SqlClient> {
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const crud = yield* SqlModel.makeRepository(model, options);
		function fieldAt(key: string) {
			const field = Object.hasOwn(model.fields, key) ? model.fields[key] : undefined;
			return field === undefined
				? Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(model.ast, key))))
				: Effect.succeed(field);
		}
		function predicate(key: string, value: unknown) {
			return Effect.map(
				Effect.flatMap(fieldAt(key), (field) => Schema.encodeEffect(field)(value)),
				(encoded) => (encoded === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${encoded}`),
			);
		}
		function orderClause(orderBy: FindMany<TModel, Key<TModel>>["orderBy"]) {
			return orderBy === undefined
				? Effect.succeed(sql``)
				: Effect.as(fieldAt(orderBy.field), sql`order by ${sql(orderBy.field)} ${sql.literal(orderBy.direction === "desc" ? "desc" : "asc")}`);
		}
		function limitClause(limit: number | undefined) {
			return limit === undefined ? Effect.succeed(sql``) : Effect.map(Schema.decodeUnknownEffect(Limit)(limit), (count) => sql`limit ${count}`);
		}
		function findMany<TKey extends Key<TModel> = Key<TModel>>(
			query?: FindMany<TModel, TKey>,
		): Effect.Effect<
			Pick<Row<TModel>, TKey>[],
			SqlError | Schema.SchemaError,
			TModel["fields"][Key<TModel>]["EncodingServices"] | TModel["fields"][TKey]["DecodingServices"]
		>;
		// Object.fromEntries erases the selected key-to-schema correspondence, so the typed overload restates it.
		function findMany(query: FindMany<TModel, Key<TModel>> = {}): Effect.Effect<unknown, SqlError | Schema.SchemaError, unknown> {
			return Effect.gen(function* () {
				const keys = query.select ?? Object.keys(model.fields);
				const fields = Object.fromEntries(yield* Effect.forEach(keys, (key) => Effect.map(fieldAt(key), (field) => [key, field] as const)));
				const predicates = yield* Effect.forEach(
					Object.entries(query.where ?? {}).filter(([, value]) => value !== undefined),
					([key, value]) => predicate(key, value),
				);
				const order = yield* orderClause(query.orderBy);
				const limit = yield* limitClause(query.limit);
				const rows =
					yield* sql`select ${sql.csv(keys.map((key) => sql`${sql(key)}`))} from ${sql(options.tableName)} where ${sql.and(predicates)} ${order} ${limit}`;
				return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(fields)))(rows);
			}).pipe(Effect.withSpan(`${options.spanPrefix}.findMany`));
		}
		return options.versionColumn === undefined
			? { ...crud, findMany }
			: {
					...crud,
					...makeVersionedWrites(model, sql, {
						...options,
						conflict: (id, expectedVersion) => new OptimisticConcurrencyError({ expectedVersion, id, tableName: options.tableName }),
						versionColumn: options.versionColumn,
					}),
					findMany,
				};
	});
}
