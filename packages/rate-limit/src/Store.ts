import { Context, Data, type Effect, Predicate } from "effect";
import type { TooManyRequests } from "@shivaedev/errors/taxonomy.ts";

export class StoreError extends Data.TaggedError("RateLimitStoreError")<{ readonly cause: unknown }> {
	// A cause that cannot say whether a retry helps is treated as an unreachable store.
	get isRetryable(): boolean {
		return Predicate.hasProperty(this.cause, "isRetryable") ? this.cause.isRetryable === true : true;
	}
}

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
