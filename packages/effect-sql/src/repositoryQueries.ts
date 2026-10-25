import { Effect, Schema } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import { latestPerGroup as makeLatestPerGroup } from "#latestPerGroup.ts";
import type { FindMany, LatestPerGroup } from "#repository.ts";
import { makeFilter } from "#repositoryFilter.ts";

type Key<TModel extends Model.Any> = Extract<keyof TModel["fields"] & keyof Row<TModel>, string>;
type Row<TModel extends Model.Any> = Schema.Struct.Type<TModel["fields"]>;

const Limit = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const CountResult = Schema.Tuple([Schema.Struct({ count: Schema.NumberFromString })]);

export interface RepositorySelect<TFields extends Schema.Struct.Fields, TServices = never> {
	readonly fields: TFields;
	readonly statement: Effect.Effect<Fragment, Schema.SchemaError, TServices>;
}

export interface Queries<TModel extends Model.Any> {
	count: (
		query?: Pick<FindMany<TModel, Key<TModel>>, "where">,
	) => Effect.Effect<number, SqlError | Schema.SchemaError, TModel["fields"][Key<TModel>]["EncodingServices"]>;
	findMany: <TKey extends Key<TModel> = Key<TModel>>(
		query?: FindMany<TModel, TKey>,
	) => Effect.Effect<
		Pick<Row<TModel>, TKey>[],
		SqlError | Schema.SchemaError,
		TModel["fields"][Key<TModel>]["EncodingServices"] | TModel["fields"][TKey]["DecodingServices"]
	>;
	latestPerGroup: (
		query: LatestPerGroup<TModel>,
	) => Effect.Effect<
		Row<TModel>[],
		SqlError | Schema.SchemaError,
		TModel["fields"][Key<TModel>]["EncodingServices"] | TModel["fields"][Key<TModel>]["DecodingServices"]
	>;
	select: <TKey extends Key<TModel> = Key<TModel>>(
		query?: FindMany<TModel, TKey>,
	) => RepositorySelect<Pick<TModel["fields"], TKey>, TModel["fields"][Key<TModel>]["EncodingServices"]>;
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
	const readLatest = makeLatestPerGroup(model, sql, options.tableName);
	function count(query?: Pick<FindMany<TModel, Key<TModel>>, "where">): ReturnType<Queries<TModel>["count"]>;
	function count(query: Pick<FindMany<TModel, Key<TModel>>, "where"> = {}): Effect.Effect<number, SqlError | Schema.SchemaError, unknown> {
		return Effect.gen(function* () {
			const predicate = yield* where(query.where, true, true);
			const rows = yield* sql`select cast(count(*) as text) as count from ${sql(options.tableName)} where ${predicate}`;
			const [result] = yield* Schema.decodeUnknownEffect(CountResult)(rows);
			return result.count;
		}).pipe(Effect.withSpan(`${options.spanPrefix}.count`));
	}
	function orderClause(orderBy: FindMany<TModel, Key<TModel>>["orderBy"]) {
		if (orderBy === undefined) {
			return Effect.succeed(sql``);
		}
		const entries = "field" in orderBy ? [orderBy] : orderBy;
		return Effect.map(
			Effect.forEach(entries, ({ field, direction }) =>
				Effect.as(fieldAt(field), sql`${sql(field)} ${sql.literal(direction === "desc" ? "desc" : "asc")}`),
			),
			(columns) => sql`order by ${sql.csv(columns)}`,
		);
	}
	function limitClause(limit: number | undefined) {
		return limit === undefined ? Effect.succeed(sql``) : Effect.map(Schema.decodeUnknownEffect(Limit)(limit), (rowLimit) => sql`limit ${rowLimit}`);
	}
	function select<TKey extends Key<TModel> = Key<TModel>>(
		query?: FindMany<TModel, TKey>,
	): RepositorySelect<Pick<TModel["fields"], TKey>, TModel["fields"][Key<TModel>]["EncodingServices"]>;
	function select(query: FindMany<TModel, Key<TModel>> = {}): RepositorySelect<Schema.Struct.Fields, unknown> {
		const keys = query.select ?? Object.keys(model.fields);
		const fields = Object.fromEntries(keys.map((key) => [key, model.fields[key]]));
		const statement = Effect.gen(function* () {
			yield* Effect.forEach(keys, fieldAt);
			const predicate = yield* where(query.where, true, true);
			const order = yield* orderClause(query.orderBy);
			const limit = yield* limitClause(query.limit);
			return sql`select ${sql.csv(keys.map((key) => sql`${sql(key)}`))} from ${sql(options.tableName)} where ${predicate} ${order} ${limit}`;
		});
		return { fields, statement };
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
			const selected = select(query);
			const rows = yield* sql`${yield* selected.statement}`;
			return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.Struct(selected.fields)))(rows);
		}).pipe(Effect.withSpan(`${options.spanPrefix}.findMany`));
	}
	function latestPerGroup(query: LatestPerGroup<TModel>): ReturnType<Queries<TModel>["latestPerGroup"]>;
	function latestPerGroup(query: LatestPerGroup<TModel>): Effect.Effect<unknown, SqlError | Schema.SchemaError, unknown> {
		return Effect.gen(function* () {
			const order = yield* orderClause(query.orderBy);
			const rowLimit = yield* Schema.decodeUnknownEffect(Limit)(query.limit);
			return yield* readLatest(query, order, rowLimit);
		}).pipe(Effect.withSpan(`${options.spanPrefix}.latestPerGroup`));
	}
	return { count, findMany, latestPerGroup, select };
}
