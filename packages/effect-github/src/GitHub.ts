import { Effect, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { paginate } from "@shivaedev/platform/http-client/paginate.ts";
import type { CachedResponse } from "./cache.ts";
import { GitHubConfig } from "./GitHubConfig.ts";
import { GitHubToken } from "./GitHubToken.ts";
import { jsonResponse } from "./json.ts";
import { rateLimits } from "./rateLimits.ts";
import { requests } from "./requests.ts";

export const GitHub = defineService({
	id: "@shivaedev/effect-github/GitHub",
	initialize: Effect.gen(function* () {
		const config = yield* GitHubConfig;
		const rates = rateLimits();
		return {
			apiUrl: config.apiUrl,
			rates,
			request: requests(yield* HttpClient.HttpClient, yield* GitHubToken, rates),
		};
	}),
	methods: ({ apiUrl, rates, request }) => {
		function get(path: string, accept = "application/vnd.github+json") {
			return HttpClientRequest.get(new URL(path, apiUrl).href, { headers: { Accept: accept } });
		}
		function readRepresentation(path: string) {
			return Effect.map(request(get(path), 1024 * 1024), jsonResponse);
		}
		function listRepresentations(path: string) {
			const entries = new WeakMap<HttpClientResponse.HttpClientResponse, CachedResponse>();
			const client = HttpClient.makeWith(
				(effect: Effect.Effect<HttpClientRequest.HttpClientRequest>) =>
					Effect.flatMap(effect, (input) =>
						Effect.map(request(input, 1024 * 1024), (entry) => {
							entries.set(entry.response, entry);
							return entry.response;
						}),
					),
				Effect.succeed,
			);
			return Effect.succeed(
				paginate(client, get(path)).pipe(
					Stream.mapEffect((response) => Effect.fromNullishOr(entries.get(response))),
					Stream.map(jsonResponse),
				),
			);
		}
		function writeRepresentation(method: "POST" | "PATCH", path: string, body: unknown) {
			return HttpClientRequest.make(method)(new URL(path, apiUrl).href, { headers: { Accept: "application/vnd.github+json" } }).pipe(
				HttpClientRequest.bodyJson(body),
				Effect.flatMap((input) => request(input, 1024 * 1024)),
				Effect.map(jsonResponse),
			);
		}
		return {
			bytes: (path: string, accept: string, limit: number) => Effect.map(request(get(path, accept), limit), (entry) => entry.bytes),
			list: listRepresentations,
			observations: () => Effect.sync(() => [...rates.observations.values()]),
			read: readRepresentation,
			text: (path: string, accept: string, limit: number) =>
				Effect.map(request(get(path, accept), limit), (entry) => new TextDecoder().decode(entry.bytes)),
			write: writeRepresentation,
		};
	},
	requires: [HttpClient.HttpClient, GitHubToken],
});

export function read<TSchema extends Schema.Constraint>(path: string, schema: TSchema) {
	return Effect.flatMap(GitHub, (github) => Effect.flatMap(github.read(path), (response) => response.decode(schema)));
}

export function list<TSchema extends Schema.Constraint>(path: string, schema: TSchema) {
	return Stream.unwrap(Effect.flatMap(GitHub, (github) => github.list(path))).pipe(
		Stream.mapEffect((response) => response.decode(Schema.Array(schema))),
		Stream.flatMap(Stream.fromIterable),
	);
}

export function write<TSchema extends Schema.Constraint>(method: "POST" | "PATCH", path: string, body: unknown, schema: TSchema) {
	return Effect.flatMap(GitHub, (github) => Effect.flatMap(github.write(method, path, body), (response) => response.decode(schema)));
}
