import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { FindMany } from "#repository.ts";
import { makeFilter } from "#repositoryFilter.ts";

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

const Limit = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export interface Queries<TModel extends Model.Any> {
	findMany: <TKey extends Key<TModel> = Key<TModel>>(
		query?: FindMany<TModel, TKey>,
	) => Effect.Effect<
		Pick<Row<TModel>, TKey>[],
		SqlError | Schema.SchemaError,
		TModel["fields"][Key<TModel>]["EncodingServices"] | TModel["fields"][TKey]["DecodingServices"]
	>;
}

export function makeQueries<TModel extends Model.Any>(
	model: TModel,
	sql: SqlClient.SqlClient,
	options: {
		readonly tableName: string;
		readonly spanPrefix: string;
	},
): Queries<TModel> {
	const { fieldAt, where } = makeFilter(model, sql);
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
			const predicate = yield* where(query.where);
			const order = yield* orderClause(query.orderBy);
			const limit = yield* limitClause(query.limit);
			const rows =
				yield* sql`select ${sql.csv(keys.map((key) => sql`${sql(key)}`))} from ${sql(options.tableName)} where ${predicate} ${order} ${limit}`;
			return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(fields)))(rows);
		}).pipe(Effect.withSpan(`${options.spanPrefix}.findMany`));
	}
	return { findMany };
}
