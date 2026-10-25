import { Clock, DateTime, Effect, Schema, Stream } from "effect";
import { GitHubRateLimited } from "@shivaedev/effect-github/errors.ts";
import { GitHub } from "@shivaedev/effect-github/GitHub.ts";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { WatchError } from "#model.ts";
import { pollDelay, quotaRetryAt } from "#quota.ts";

export const GitHubHttp = defineService({
	id: "@shivaedev/pr-watch/GitHubHttp",
	initialize: Effect.gen(function* () {
		return { github: yield* GitHub, requests: 0, retryAt: 0 };
	}),
	methods: (state) => {
		function request<T, E, R>(operation: Effect.Effect<T, E, R>) {
			return Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const observations = yield* state.github.observations();
				if (quotaRetryAt(observations, state.retryAt) > now) {
					return yield* new WatchError({ message: "GitHub quota cooldown", retryAt: quotaRetryAt(observations, state.retryAt) });
				}
				return yield* operation;
			}).pipe(
				Effect.scoped,
				Effect.timeout("30 seconds"),
				Effect.tapError((cause) =>
					Effect.sync(() => {
						if (cause instanceof GitHubRateLimited) {
							state.retryAt = DateTime.toEpochMillis(cause.retryAt);
						}
					}),
				),
				Effect.mapError((cause) => {
					if (cause instanceof WatchError) {
						return cause;
					}
					if (cause instanceof GitHubRateLimited) {
						return new WatchError({ message: "GitHub quota cooldown", retryAt: DateTime.toEpochMillis(cause.retryAt) });
					}
					return new WatchError({ message: "GitHub request failed" });
				}),
			);
		}
		function counted<T, E, R>(operation: Effect.Effect<T, E, R>) {
			return Effect.suspend(() => {
				state.requests += 1;
				return operation;
			});
		}
		return {
			delay: (interval: number) =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					const observations = yield* state.github.observations();
					const delay = pollDelay(observations, interval, Math.max(1, state.requests), now, state.retryAt);
					state.requests = 0;
					return delay;
				}),
			get: (url: string) => request(counted(state.github.read(url)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown)))),
			list: (url: string) =>
				request(
					Stream.unwrap(state.github.list(url)).pipe(
						Stream.mapEffect((response) => counted(response.decode(Schema.Unknown))),
						Stream.runCollect,
					),
				),
			post: (url: string, body: unknown) =>
				request(counted(state.github.write("POST", url, body)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown)))),
		};
	},
	requires: [GitHub],
});
