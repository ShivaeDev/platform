import { Context, type Effect } from "effect";

export type QueryStorageOperation<A> = A | Effect.Effect<A, unknown>;

export interface StoredQuery {
	readonly key: string;
	readonly used: number;
	readonly value: string;
}

export interface QueryStorage {
	readonly clear: (user?: string) => QueryStorageOperation<void>;
	readonly getAll: (user: string) => QueryStorageOperation<readonly StoredQuery[]>;
	readonly removeItems: (user: string, keys: readonly string[]) => QueryStorageOperation<void>;
	readonly setItems: (user: string, entries: readonly StoredQuery[]) => QueryStorageOperation<void>;
}

export class QueryStorageProvider extends Context.Service<QueryStorageProvider, () => QueryStorage>()("@shivaedev/contract/QueryStorageProvider") {}
