import type { BetterAuthRateLimitOptions } from "better-auth";
import { Clock, Effect } from "effect";
import { Store } from "@shivaedev/rate-limit/Store.ts";

export const rateLimitStorage = Effect.gen(function* () {
	const store = yield* Store;
	const run = Effect.runPromiseWith(yield* Effect.context<Store>());
	const storage: NonNullable<BetterAuthRateLimitOptions["customStorage"]> = {
		consume: (key, rule) =>
			run(
				store.consume({ key: `identity:auth:${key}`, per: rule.max, windowMillis: rule.window * 1000 }).pipe(
					Effect.as({ allowed: true, retryAfter: null }),
					Effect.catchTag("TooManyRequests", (error) =>
						Effect.map(Clock.currentTimeMillis, (now) => ({
							allowed: false,
							retryAfter: Math.max(1, Math.ceil(((error.retryAt ?? now + rule.window * 1000) - now) / 1000)),
						})),
					),
				),
			),
	};
	return storage;
});
