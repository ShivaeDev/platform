import { Schema } from "effect";
import { QueryReadDenied } from "#readPolicyErrors.ts";

export interface QueryResult {
	readonly _tag: "Result";
	readonly query: string;
	readonly queryIndex: number;
	readonly value: unknown;
}
export interface QueryUnchanged {
	readonly _tag: "Unchanged";
	readonly queryIndex: number;
}
export type SubscriptionEvent = { readonly _tag: "Delivered" } | QueryReadDenied;
export type QueryUpdate = QueryReadDenied | QueryResult | QueryUnchanged;

export const QueryUpdate = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Result"), query: Schema.String, queryIndex: Schema.Number, value: Schema.Unknown }),
	Schema.Struct({ _tag: Schema.Literal("Unchanged"), queryIndex: Schema.Number }),
	QueryReadDenied,
]);
