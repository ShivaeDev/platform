import type { LiveHint } from "#live.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export interface QueryResult {
	readonly _tag: "Result";
	readonly query: string;
	readonly queryIndex: number;
	readonly value: unknown;
}
export type SubscriptionHint = LiveHint | QueryReadDenied;
export type QueryUpdate = SubscriptionHint | QueryResult;
