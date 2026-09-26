import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/unstable/schema";
import { SqlClient, SqlModel } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";

export { migratePostgres, type PostgresMigrationOptions } from "./migrations.ts";

type Key<S extends Model.Any> = Extract<keyof S["fields"] & keyof Row<S>, string>;
type Row<S extends Model.Any> = Schema.Struct.Type<S["fields"]>;

export interface FindMany<S extends Model.Any, K extends Key<S>> {
	readonly select?: readonly [K, ...K[]];
	readonly where?: { readonly [F in keyof Row<S>]?: Row<S>[F] | undefined };
	readonly orderBy?: {
		readonly field: Key<S>;
		readonly direction: "asc" | "desc";
	};
	readonly limit?: number;
}

const Limit = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export const makeRepository = <S extends Model.Any, Id extends keyof S["Type"] & keyof S["update"]["Type"] & keyof S["fields"]>(
	model: S,
	options: {
		readonly tableName: string;
		readonly idColumn: Id;
		readonly spanPrefix: string;
	},
) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const crud = yield* SqlModel.makeRepository(model, options);
		const fieldAt = (key: string) => {
			const field = Object.hasOwn(model.fields, key) ? model.fields[key] : undefined;
			return field === undefined
				? Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(model.ast, key))))
				: Effect.succeed(field);
		};
		const predicate = (key: string, value: unknown) =>
			Effect.map(
				Effect.flatMap(fieldAt(key), (field) => Schema.encodeEffect(field)(value)),
				(encoded) => (encoded === null ? sql`${sql(key)} is null` : sql`${sql(key)} = ${encoded}`),
			);
		const orderClause = (orderBy: FindMany<S, Key<S>>["orderBy"]) =>
			orderBy === undefined
				? Effect.succeed(sql``)
				: Effect.as(fieldAt(orderBy.field), sql`order by ${sql(orderBy.field)} ${sql.literal(orderBy.direction === "desc" ? "desc" : "asc")}`);
		const limitClause = (limit: number | undefined) =>
			limit === undefined ? Effect.succeed(sql``) : Effect.map(Schema.decodeUnknownEffect(Limit)(limit), (count) => sql`limit ${count}`);
		function findMany<K extends Key<S> = Key<S>>(
			query?: FindMany<S, K>,
		): Effect.Effect<
			Array<Pick<Row<S>, K>>,
			SqlError | Schema.SchemaError,
			S["fields"][Key<S>]["EncodingServices"] | S["fields"][K]["DecodingServices"]
		>;
		// Object.fromEntries erases the selected key-to-schema correspondence, so the typed overload restates it.
		function findMany(query: FindMany<S, Key<S>> = {}): Effect.Effect<unknown, SqlError | Schema.SchemaError, unknown> {
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
		return { ...crud, findMany };
	});
export { type InvalidationKeys, invalidateOnCommit, type TransactOptions, transact } from "./transact.ts";
