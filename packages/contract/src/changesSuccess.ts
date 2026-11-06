import { Schema } from "effect";
import { LiveHint } from "#live.ts";
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
			| ("rerun-and-compare" extends TQuery["live"] ? typeof QueryUnchanged : never)
	: never;

export function changesSuccess<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
): Schema.Union<readonly [typeof LiveHint, typeof QueryReadDenied, ...ResultSchema<TQueries[number]>[]]>;
export function changesSuccess(queries: readonly QueryShape[]) {
	return Schema.Union([
		LiveHint,
		QueryReadDenied,
		...queries.flatMap((query) => [
			...(query.live === "rerun-and-compare" ? [QueryUnchanged] : []),
			Schema.Struct({
				_tag: Schema.Literal("Result"),
				query: Schema.Literal(query.name),
				queryIndex: Schema.Number,
				value: query.success,
			}),
		]),
	]);
}
