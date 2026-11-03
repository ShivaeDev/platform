import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { GitHubHttp } from "@shivaedev/pr-watch/GitHubHttp.ts";
import { WatchError } from "@shivaedev/pr-watch/model.ts";
import { failureContext } from "#engine/failureContext.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubRateLimited } from "#host/githubRateLimit.ts";

function request<A, E, R>(operation: Effect.Effect<A, E | ServiceUnavailable, R>) {
	return operation.pipe(
		Effect.scoped,
		Effect.timeout("30 seconds"),
		Effect.catchIf(
			(error): error is ServiceUnavailable => error instanceof ServiceUnavailable,
			(error) => {
				const retryAt = failureContext(error).retryAt;
				return Effect.fail(
					new WatchError({
						message: error.message,
						reason: githubRateLimited(error) ? "cooldown" : "response",
						...(retryAt === undefined ? {} : { retryAt }),
					}),
				);
			},
		),
	);
}

export const watchPrHttp = Layer.effect(GitHubHttp)(
	Effect.gen(function* () {
		const api = yield* GithubApi;
		function pacing(interval: number) {
			return api.pace(interval).pipe(Effect.map((delay) => ({ delay, message: "GitHub quota pacing" })));
		}
		return {
			delay: api.pace,
			get: (url) => request(api.read(url)),
			graphql: (apiUrl, query, variables) => {
				const url = new URL(apiUrl);
				url.pathname = url.pathname.replace(/\/api\/v3\/?$/u, "/api/graphql");
				if (!url.pathname.endsWith("/api/graphql")) {
					url.pathname = `${url.pathname.replace(/\/$/u, "")}/graphql`;
				}
				return request(api.post(url.href, { query, variables }));
			},
			list: (url) => request(api.list(url)),
			pacing,
			post: (url, body) => request(api.post(url, body)),
		};
	}),
);
