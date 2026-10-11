import { Clock, Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { type CachedResponse, decodeResponse, fetchResponse } from "./httpResponse.ts";
import { WatchError } from "./model.ts";
import { type Budget, observeBudget, pollDelay } from "./quota.ts";
export const GitHubHttp = defineService({
	id: "@shivaedev/pr-watch/GitHubHttp",
	initialize: Effect.sync(() => ({
		budget: { blockedUntil: 0, limit: 5000, remaining: 5000, reset: 0 } satisfies Budget,
		cache: new Map<string, CachedResponse>(),
		requests: 0,
	})),
	methods: (state) => ({
		delay: (interval: number) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const delay = pollDelay(state.budget, interval, Math.max(1, state.requests), now);
				state.requests = 0;
				return delay;
			}),
		get: (url: string, token: string) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				if (state.budget.blockedUntil > now) {
					return yield* Effect.fail(new WatchError({ message: "GitHub quota cooldown" }));
				}
				const cached = state.cache.get(url);
				state.requests += 1;
				const response = yield* fetchResponse(url, token, cached);
				observeBudget(state.budget, response, yield* Clock.currentTimeMillis);
				if (response.status === 304 && cached !== undefined) {
					return cached;
				}
				if (!response.ok) {
					return yield* Effect.fail(new WatchError({ message: `GitHub HTTP ${response.status} for ${new URL(url).pathname}` }));
				}
				const result = yield* decodeResponse(url, response);
				state.cache.set(url, result);
				return result;
			}),
	}),
	requires: [],
});
