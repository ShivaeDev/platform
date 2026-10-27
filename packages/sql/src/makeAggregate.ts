import { Effect, Schema, SchemaIssue } from "effect";
import type { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { Fragment } from "effect/sql/Statement";
import { aggregateColumn } from "#aggregateColumn.ts";
import type { Aggregate } from "#aggregateQuery.ts";
import { makeQueryClauses } from "#makeQueryClauses.ts";
import { type FindManyFilter, makeFilter } from "#repositoryFilter.ts";

export function makeAggregate<TModel extends Model.Any>(
	model: TModel,
	sql: SqlClient.SqlClient,
	options: { readonly tableName: string; readonly spanPrefix: string },
): Aggregate<TModel>;
export function makeAggregate(
	model: Model.Any,
	sql: SqlClient.SqlClient,
	options: { readonly tableName: string; readonly spanPrefix: string },
): unknown {
	const { fieldAt, where } = makeFilter(model, sql);
	const selectAggregate = aggregateColumn(sql, fieldAt);
	return (query: {
		readonly groupBy: readonly string[];
		readonly aggregates: Readonly<Record<string, object>>;
		readonly where?: FindManyFilter<Model.Any>;
		readonly orderBy?: readonly { readonly field: string; readonly direction: "asc" | "desc" }[];
		readonly limit?: number;
	}): Effect.Effect<unknown, SqlError | Schema.SchemaError, unknown> =>
		Effect.gen(function* () {
			const groups = yield* Schema.decodeUnknownEffect(Schema.NonEmptyArray(Schema.String))(query.groupBy);
			const fields = new Map<string, Schema.Constraint>();
			const columns: Fragment[] = [];
			const ordering = new Map<string, Fragment>();
			for (const key of groups) {
				fields.set(key, yield* fieldAt(key));
				columns.push(sql`${sql(key)}`);
			}
			for (const [name, expression] of Object.entries(query.aggregates)) {
				if (groups.includes(name)) {
					return yield* Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([name], new SchemaIssue.UnexpectedKey(model.ast, name))));
				}
				const selected = yield* selectAggregate(name, expression);
				ordering.set(name, selected.order);
				columns.push(selected.column);
				fields.set(name, selected.schema);
			}
			const Result = Schema.Struct(Object.fromEntries(fields));
			const clauses = makeQueryClauses(
				sql,
				(key) =>
					fields.has(key)
						? Effect.succeed(fields.get(key))
						: Effect.fail(new Schema.SchemaError(new SchemaIssue.Pointer([key], new SchemaIssue.UnexpectedKey(Result.ast, key)))),
				(key) => ordering.get(key) ?? sql`${sql(key)}`,
			);
			const predicate = yield* where(query.where, true, true);
			const order = yield* clauses.orderClause(query.orderBy);
			const limit = yield* clauses.limitClause(query.limit);
			const partitions = sql.csv(groups.map((key) => sql`${sql(key)}`));
			const rows = yield* sql`select ${sql.csv(columns)} from ${sql(options.tableName)} where ${predicate} group by ${partitions} ${order} ${limit}`;
			return yield* Schema.decodeUnknownEffect(Schema.Array(Result))(rows);
		}).pipe(Effect.withSpan(`${options.spanPrefix}.aggregate`));
}
