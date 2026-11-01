import { Context, Data, type Effect } from "effect";
import type { TooManyRequests } from "#TooManyRequests.ts";

export class StoreError extends Data.TaggedError("RateLimitStoreError")<{ readonly cause: unknown }> {}

export interface WindowRequest {
	readonly key: string;
	readonly per: number;
	readonly windowMillis: number;
}

export class Store extends Context.Service<
	Store,
	{
		readonly consume: (request: WindowRequest) => Effect.Effect<void, TooManyRequests | StoreError>;
	}
>()("@shivaedev/rate-limit/Store") {}
