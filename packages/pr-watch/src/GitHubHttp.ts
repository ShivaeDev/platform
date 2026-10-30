import { Clock, Effect, Schema, Stream } from "effect";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { WatchError } from "#model.ts";
import { pollPacing, quotaMessage, quotaRetryAt } from "#quota.ts";
import { requestFailure } from "#requestFailure.ts";

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
				const retryAt = quotaRetryAt(observations, state.retryAt);
				if (retryAt > now) {
					const budget = observations.find((entry) => entry.remaining === 0 && quotaRetryAt([entry]) === retryAt);
					return yield* new WatchError({
						message: budget === undefined ? "GitHub retry-after cooldown" : `GitHub quota cooldown (${quotaMessage(budget)})`,
						retryAt,
						retryable: true,
					});
				}
				return yield* operation;
			}).pipe(
				Effect.scoped,
				Effect.timeout("30 seconds"),
				Effect.catch((cause) => Effect.flatMap(state.github.observations(), (observations) => Effect.fail(requestFailure(cause, observations)))),
				Effect.tapError((error) =>
					Effect.sync(() => {
						if (error.retryAt !== undefined) {
							state.retryAt = error.retryAt;
						}
					}),
				),
			);
		}
		function counted<T, E, R>(operation: Effect.Effect<T, E, R>) {
			return Effect.suspend(() => {
				state.requests += 1;
				return operation;
			});
		}
		function pacing(interval: number) {
			return Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const observations = yield* state.github.observations();
				const result = pollPacing(observations, interval, Math.max(1, state.requests), now, state.retryAt);
				state.requests = 0;
				return result;
			});
		}
		function post(url: string, body: unknown) {
			return request(counted(state.github.write("POST", url, body)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown))));
		}
		return {
			delay: (interval: number) => pacing(interval).pipe(Effect.map((result) => result.delay)),
			get: (url: string) => request(counted(state.github.read(url)).pipe(Effect.flatMap((response) => response.decode(Schema.Unknown)))),
			graphql: (apiUrl: string, query: string, variables: unknown) => {
				const url = new URL(apiUrl);
				url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
				if (!url.pathname.endsWith("/api/graphql")) {
					url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
				}
				return post(url.href, { query, variables });
			},
			list: (url: string) =>
				request(
					Stream.unwrap(state.github.list(url)).pipe(
						Stream.mapEffect((response) => counted(response.decode(Schema.Unknown))),
						Stream.runCollect,
					),
				),
			pacing,
			post,
		};
	},
	requires: [GitHub],
});
