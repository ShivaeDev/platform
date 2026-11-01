import { Clock, type Duration, Effect } from "effect";
import { isSqlError } from "effect/sql/SqlError";
import { TestClock } from "effect/testing";
import { TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { type RateLimitOptions, rateLimit } from "#rateLimit.ts";
import { Store, StoreError } from "#Store.ts";
import { makeRpcLimiter } from "./makeRpcLimiter.ts";

export const limit = { key: "notes:alice", per: 2, window: "1 minute" } as const;

export const makeLimiter = Effect.gen(function* () {
	const store = yield* Store;
	const request = yield* makeRpcLimiter(limit);
	function attempt(options: RateLimitOptions = limit) {
		return rateLimit(options).pipe(
			Effect.provideService(Store, store),
			Effect.as("admitted" as const),
			Effect.catchTag("TooManyRequests", (error) =>
				Effect.succeed({
					key: error.key,
					refusal: error instanceof TooManyRequests ? "TooManyRequests" : "unexpected refusal",
					retryAt: error.retryAt,
				}),
			),
			Effect.catchTag("RateLimitStoreError", (error) =>
				Effect.succeed({
					refusal: error instanceof StoreError ? "RateLimitStoreError" : "unexpected store failure",
					sqlFailure: isSqlError(error.cause),
				}),
			),
		);
	}
	return {
		attempt,
		burst: (count: number, options: RateLimitOptions) =>
			Effect.forEach(Array.from({ length: count }), () => attempt(options), { concurrency: "unbounded" }),
		invalid: (options: RateLimitOptions) =>
			rateLimit(options).pipe(
				Effect.provideService(Store, store),
				Effect.catchDefect((error) => Effect.succeed(error instanceof RangeError ? "invalid limit" : "unexpected defect")),
			),
		now: () => Clock.currentTimeMillis,
		passTime: (duration: Duration.Input) => TestClock.adjust(duration),
		request,
	};
});
