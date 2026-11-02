import type { LiveHint } from "#live.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

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
export type SubscriptionHint = LiveHint | QueryReadDenied;
export type QueryUpdate = SubscriptionHint | QueryResult | QueryUnchanged;
