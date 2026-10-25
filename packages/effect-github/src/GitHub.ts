import { Effect, Schema, Stream } from "effect";
import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/effect-service/defineService.ts";
import { checkRuns } from "./checkRuns.ts";
import { GitHubConfig } from "./GitHubConfig.ts";
import { GitHubToken } from "./GitHubToken.ts";
import { rateLimits } from "./rateLimits.ts";
import { representations } from "./representations.ts";
import { requests } from "./requests.ts";
import { stickyComments } from "./stickyComments.ts";

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
		const { get, ...client } = representations(apiUrl, request);
		return {
			bytes: (path: string, accept: string, limit: number) => Effect.map(request(get(path, accept), limit), (entry) => entry.bytes),
			...client,
			...stickyComments(client),
			...checkRuns(client),
			observations: () => Effect.sync(() => [...rates.observations.values()]),
			text: (path: string, accept: string, limit: number) =>
				Effect.map(request(get(path, accept), limit), (entry) => new TextDecoder().decode(entry.bytes)),
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
