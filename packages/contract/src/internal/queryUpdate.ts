import { Schema } from "effect";
import { LiveHint } from "#live.ts";
import type { QueryShape } from "#operation.ts";

type Rerun<TQuery extends QueryShape> = TQuery extends QueryShape ? ("rerun-and-compare" extends TQuery["live"] ? TQuery : never) : never;
type ResultSchema<TQuery extends QueryShape> = TQuery extends QueryShape
	? Schema.Struct<{
			_tag: Schema.Literal<"Result">;
			query: Schema.Literal<TQuery["name"]>;
			queryIndex: Schema.Number;
			value: TQuery["success"];
		}>
	: never;

export interface QueryResult {
	readonly _tag: "Result";
	readonly query: string;
	readonly queryIndex: number;
	readonly value: unknown;
}
export type QueryUpdate = LiveHint | QueryResult;

export function changesSuccess<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
): Schema.Union<readonly [typeof LiveHint, ...ResultSchema<Rerun<TQueries[number]>>[]]>;
export function changesSuccess(queries: readonly QueryShape[]) {
	return Schema.Union([
		LiveHint,
		...queries
			.filter((query) => query.live === "rerun-and-compare")
			.map((query) =>
				Schema.Struct({
					_tag: Schema.Literal("Result"),
					query: Schema.Literal(query.name),
					queryIndex: Schema.Number,
					value: query.success,
				}),
			),
	]);
}

export function rerunErrors<const TQueries extends readonly QueryShape[]>(queries: TQueries): readonly Rerun<TQueries[number]>["error"][];
export function rerunErrors(queries: readonly QueryShape[]) {
	return queries.filter((query) => query.live === "rerun-and-compare").map((query) => query.error);
}
