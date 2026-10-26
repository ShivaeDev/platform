import { Clock, DateTime, Effect, Layer, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/http";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { GitHubRateLimited } from "@shivaedev/github/errors.ts";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { type GithubObservation, type GithubPause, githubPaused, pace, type RecordedObservation, reservedUntil } from "#host/githubRateLimit.ts";
import { githubToken } from "#host/githubToken.ts";

const PAGE_LIMIT = 100;

export const GithubApi = defineService({
	id: "Fleet/GithubApi",
	initialize: Effect.gen(function* () {
		return {
			blocks: new Map<string, number>(),
			github: yield* GitHub,
			observations: new Map<string, RecordedObservation>(),
			seen: new WeakSet<object>(),
		};
	}),
	methods: (state) => {
		function paused(resource: string, now: number): { readonly by: GithubPause; readonly until: number } | undefined {
			const blocked = state.blocks.get(resource);
			if (blocked !== undefined && blocked > now) {
				return { by: "rate-limit", until: blocked };
			}
			const reserved = reservedUntil(state.observations.get(resource), now);
			return reserved === undefined ? undefined : { by: "reserve", until: reserved };
		}
		function limited(observation: RecordedObservation, now: number): GithubObservation {
			const pause = paused(observation.resource, now);
			return { ...observation, limitedBy: pause?.by ?? null, limitedUntil: pause?.until ?? null };
		}
		const observe = Effect.gen(function* () {
			const observedAt = yield* Clock.currentTimeMillis;
			for (const observation of yield* state.github.observations()) {
				if (!state.seen.has(observation)) {
					state.seen.add(observation);
					state.observations.set(observation.resource, { ...observation, observedAt, reset: DateTime.toEpochMillis(observation.reset) / 1000 });
				}
			}
		});
		function request<A, E, R>(endpoint: string, read: Effect.Effect<A, E, R>) {
			return Effect.gen(function* () {
				const resource = yield* state.github.resource(endpoint);
				const pause = paused(resource, yield* Clock.currentTimeMillis);
				if (pause !== undefined) {
					return yield* githubPaused(pause.by, pause.until);
				}
				return yield* read.pipe(
					Effect.onExit(() => observe),
					Effect.mapError((error) => {
						if (error instanceof ServiceUnavailable) {
							return error;
						}
						if (error instanceof GitHubRateLimited) {
							const until = DateTime.toEpochMillis(error.retryAt);
							state.blocks.set(error.resource, until);
							return githubPaused("rate-limit", until);
						}
						return new ServiceUnavailable({ message: "GitHub evidence could not be read; check authentication and repository access" });
					}),
				);
			});
		}
		function pagePolicy() {
			let count = 0;
			return (resource: string) =>
				Effect.gen(function* () {
					yield* observe;
					const pause = paused(resource, yield* Clock.currentTimeMillis);
					if (pause !== undefined) {
						return yield* githubPaused(pause.by, pause.until);
					}
					if (count >= PAGE_LIMIT) {
						return yield* new ServiceUnavailable({ message: `GitHub returned more than ${PAGE_LIMIT} pages` });
					}
					count += 1;
				});
		}

		return {
			get: (endpoint: string) =>
				request(
					endpoint,
					state.github.read(endpoint).pipe(
						Effect.flatMap((page) => page.decode(Schema.Unknown)),
						Effect.map(JSON.stringify),
					),
				),
			observations: () =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					return [...state.observations.values()]
						.map((observation) => limited(observation, now))
						.sort((left, right) => left.resource.localeCompare(right.resource));
				}),
			pace: (intervalMs: number) =>
				Effect.gen(function* () {
					const now = yield* Clock.currentTimeMillis;
					const core = state.observations.get("core");
					return pace(core === undefined ? undefined : limited(core, now), intervalMs, now);
				}),
			pages: (endpoint: string) =>
				Effect.gen(function* () {
					const pages = yield* state.github.list(endpoint, pagePolicy());
					const bodies = yield* request(
						endpoint,
						pages.pipe(
							Stream.mapEffect((page) => page.decode(Schema.Unknown)),
							Stream.runCollect,
						),
					);
					return JSON.stringify(bodies);
				}),
		};
	},
	requires: [GitHub],
});
export type GithubApi = typeof GithubApi.Identifier;

export const githubApiLayer = GithubApi.layer.pipe(
	Layer.provide(GitHub.layer.pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(githubToken))),
);
