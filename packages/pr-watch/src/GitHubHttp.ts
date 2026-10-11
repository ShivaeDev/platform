import { Clock, Effect } from "effect";
import { HttpClient } from "effect/unstable/http";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { type CachedResponse, decodeResponse, fetchResponse } from "./httpResponse.ts";
import { WatchError } from "./model.ts";
import { type Budget, observeBudget, pollDelay } from "./quota.ts";
export const GitHubHttp = defineService({
	id: "@shivaedev/pr-watch/GitHubHttp",
	initialize: Effect.gen(function* () {
		return {
			budget: { blockedUntil: 0, limit: 5000, remaining: 5000, reset: 0 } satisfies Budget,
			cache: new Map<string, CachedResponse>(),
			client: yield* HttpClient.HttpClient,
			requests: 0,
		};
	}),
	methods: (state) => {
		function request(url: string, token: string, body?: unknown) {
			return Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				if (state.budget.blockedUntil > now) {
					return yield* Effect.fail(new WatchError({ message: "GitHub quota cooldown" }));
				}
				const cached = body === undefined ? state.cache.get(url) : undefined;
				state.requests += 1;
				const response = yield* fetchResponse(state.client, url, token, cached, body);
				observeBudget(state.budget, response, yield* Clock.currentTimeMillis);
				if (response.status === 304 && cached !== undefined) {
					return cached;
				}
				const result = yield* decodeResponse(url, response);
				if (body === undefined) {
					state.cache.set(url, result);
				}
				return result;
			}).pipe(
				Effect.scoped,
				Effect.timeout("30 seconds"),
				Effect.mapError((cause) => (cause instanceof WatchError ? cause : new WatchError({ message: cause.message }))),
			);
		}
		return {
			delay: (interval: number) =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					const delay = pollDelay(state.budget, interval, Math.max(1, state.requests), now);
					state.requests = 0;
					return delay;
				}),
			get: (url: string, token: string) => request(url, token),
			post: (url: string, token: string, body: unknown) => request(url, token, body),
		};
	},
	requires: [HttpClient.HttpClient],
});
