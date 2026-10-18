import { Clock, Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import {
	type GithubObservation,
	type GithubPause,
	githubPaused,
	pace,
	type RecordedObservation,
	rateLimitWait,
	readObservation,
	reservedUntil,
} from "#host/githubRateLimit.ts";
import { nextLink, type ParsedResponse, parseResponse, requestResource } from "#host/githubResponse.ts";
import { GithubTransport, ghTransport } from "#host/githubTransport.ts";

interface Page {
	readonly body: string;
	readonly etag: string | undefined;
	readonly next: string | undefined;
}
interface Block {
	readonly failures: number;
	readonly until: number;
}

const CACHE_LIMIT = 1000;
const PAGE_LIMIT = 100;

export const GithubApi = defineService({
	id: "Fleet/GithubApi",
	initialize: Effect.gen(function* () {
		return {
			blocks: new Map<string, Block>(),
			cache: new Map<string, Page>(),
			observations: new Map<string, RecordedObservation>(),
			transport: yield* GithubTransport,
		};
	}),
	methods: (state) => {
		function remember(url: string, page: Page) {
			state.cache.delete(url);
			state.cache.set(url, page);
			for (const key of state.cache.keys()) {
				if (state.cache.size <= CACHE_LIMIT) {
					break;
				}
				state.cache.delete(key);
			}
			return page;
		}
		function paused(resource: string, now: number): { readonly by: GithubPause; readonly until: number } | undefined {
			const blocked = state.blocks.get(resource)?.until;
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
		const settle = Effect.fn("Fleet.settle")(function* (url: string, exitCode: number, response: ParsedResponse, now: number) {
			const observation = readObservation(response.headers, now);
			const resource = observation?.resource ?? requestResource(url);
			if (observation !== undefined) {
				state.observations.set(resource, observation);
			}
			const previous = state.blocks.get(resource);
			const wait = rateLimitWait(response, observation, now, previous?.failures ?? 0);
			if (wait !== undefined) {
				const until = Math.max(wait, previous?.until ?? 0);
				state.blocks.set(resource, { failures: (previous?.failures ?? 0) + 1, until });
				return yield* githubPaused("rate-limit", until);
			}
			state.blocks.delete(resource);
			const cached = state.cache.get(url);
			if (response.status === 304 && cached !== undefined) {
				return remember(url, cached);
			}
			if (exitCode !== 0 || response.status < 200 || response.status > 299) {
				return yield* new ServiceUnavailable({ message: `GitHub request failed with HTTP ${response.status}` });
			}
			return remember(url, { body: response.body, etag: response.headers.get("etag"), next: nextLink(response.headers) });
		});
		const request = Effect.fn("Fleet.request")(function* (url: string) {
			const pause = paused(requestResource(url), yield* Clock.currentTimeMillis);
			if (pause !== undefined) {
				return yield* githubPaused(pause.by, pause.until);
			}
			const etag = state.cache.get(url)?.etag;
			const { exitCode, output } = yield* state.transport([
				"api",
				"--include",
				"--method",
				"GET",
				...(etag === undefined ? [] : ["--header", `If-None-Match: ${etag}`]),
				url,
			]);
			const response = parseResponse(output);
			if (response === undefined) {
				return yield* new ServiceUnavailable({ message: "GitHub returned a response without an HTTP status" });
			}
			return yield* settle(url, exitCode, response, yield* Clock.currentTimeMillis);
		});
		return {
			get: (endpoint: string) => request(endpoint).pipe(Effect.map(({ body }) => body)),
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
					const bodies: string[] = [];
					let next: string | undefined = endpoint;
					while (next !== undefined) {
						if (bodies.length >= PAGE_LIMIT) {
							return yield* new ServiceUnavailable({ message: `GitHub returned more than ${PAGE_LIMIT} pages` });
						}
						const page: Page = yield* request(next);
						bodies.push(page.body);
						next = page.next;
					}
					return `[${bodies.join(",")}]`;
				}),
		};
	},
	requires: [GithubTransport],
});
export type GithubApi = typeof GithubApi.Identifier;

export const githubApiLayer = GithubApi.layer.pipe(Layer.provide(ghTransport));
