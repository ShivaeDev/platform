import { Schema } from "effect";
import type { QueryShape } from "#operation.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export const QueryUnchanged = Schema.Struct({ _tag: Schema.Literal("Unchanged"), queryIndex: Schema.Number });

type ResultSchema<TQuery extends QueryShape> = TQuery extends QueryShape
	?
			| Schema.Struct<{
					_tag: Schema.Literal<"Result">;
					query: Schema.Literal<TQuery["name"]>;
					queryIndex: Schema.Number;
					value: TQuery["success"];
			  }>
			| typeof QueryUnchanged
	: never;

export function changesSuccess<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
): Schema.Union<readonly [typeof QueryReadDenied, ...ResultSchema<TQueries[number]>[]]>;
export function changesSuccess(queries: readonly QueryShape[]) {
	return Schema.Union([
		QueryReadDenied,
		...queries.flatMap((query) => [
			QueryUnchanged,
			Schema.Struct({
				_tag: Schema.Literal("Result"),
				query: Schema.Literal(query.name),
				queryIndex: Schema.Number,
				value: query.success,
			}),
		]),
	]);
}
