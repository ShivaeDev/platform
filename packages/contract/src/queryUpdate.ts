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
export const QuerySyncing = Schema.Struct({ _tag: Schema.Literal("Syncing") });
export type QuerySyncing = typeof QuerySyncing.Type;
export const QuerySynced = Schema.Struct({ _tag: Schema.Literal("Synced"), ids: Schema.Array(Schema.Number) });
export type QuerySynced = typeof QuerySynced.Type;
export type SubscriptionEvent = { readonly _tag: "Delivered" } | QueryReadDenied;
export type QueryUpdate = QueryReadDenied | QueryResult | QueryUnchanged | QuerySyncing | QuerySynced;

export const QueryUpdate = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Result"), query: Schema.String, queryIndex: Schema.Number, value: Schema.Unknown }),
	Schema.Struct({ _tag: Schema.Literal("Unchanged"), queryIndex: Schema.Number }),
	QuerySyncing,
	QuerySynced,
	QueryReadDenied,
]);
