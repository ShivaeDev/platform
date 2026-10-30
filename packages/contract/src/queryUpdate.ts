import type { LiveHint } from "#live.ts";

export interface QueryResult {
	readonly _tag: "Result";
	readonly query: string;
	readonly queryIndex: number;
	readonly value: unknown;
}
export type QueryUpdate = LiveHint | QueryResult;
