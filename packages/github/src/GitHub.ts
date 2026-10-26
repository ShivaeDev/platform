import { Effect, Schema, Stream } from "effect";
import { HttpClient } from "effect/http";
import { defineService } from "@shivaedev/service/defineService.ts";
import { artifacts } from "#artifacts.ts";
import { checkRuns } from "#checkRuns.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { rateLimits } from "#rateLimits.ts";
import { representations } from "#representations.ts";
import { requests } from "#requests.ts";
import { stickyComments } from "#stickyComments.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export const GitHub = defineService({
	id: "@shivaedev/github/GitHub",
	initialize: Effect.gen(function* () {
		const config = yield* GitHubConfig;
		const rates = rateLimits();
		const client = yield* HttpClient.HttpClient;
		const token = yield* GitHubToken;
		const refresh = yield* TokenRefresh;
		return {
			apiUrl: config.apiUrl,
			archive: artifacts(config.apiUrl, client, token, rates, refresh),
			rates,
			request: requests(client, token, rates, refresh),
			responseByteLimit: config.responseByteLimit,
		};
	}),
	methods: ({ apiUrl, archive, rates, request, responseByteLimit }) => {
		const { get, ...client } = representations(apiUrl, request, rates.resource, responseByteLimit);
		return {
			bytes: (path: string, accept: string, limit: number) => Effect.map(request(get(path, accept), limit), (entry) => entry.bytes),
			...client,
			...archive,
			...stickyComments(client),
			...checkRuns(client),
			observations: () => Effect.sync(() => [...rates.observations.values()]),
			resource: (path: string) => Effect.sync(() => rates.resource(new URL(path, apiUrl).pathname)),
			text: (path: string, accept: string, limit: number) =>
				Effect.map(request(get(path, accept), limit), (entry) => new TextDecoder().decode(entry.bytes)),
		};
	},
	requires: [HttpClient.HttpClient, GitHubToken],
});

export function read<TSchema extends Schema.Constraint>(path: string, schema: TSchema, responseByteLimit?: number) {
	return Effect.flatMap(GitHub, (github) => Effect.flatMap(github.read(path, responseByteLimit), (response) => response.decode(schema)));
}

export function list<TSchema extends Schema.Constraint>(path: string, schema: TSchema, responseByteLimit?: number) {
	return Stream.unwrap(Effect.flatMap(GitHub, (github) => github.list(path, undefined, responseByteLimit))).pipe(
		Stream.mapEffect((response) => response.decode(Schema.Array(schema))),
		Stream.flatMap(Stream.fromIterable),
	);
}

export function write<TSchema extends Schema.Constraint>(
	method: "POST" | "PATCH",
	path: string,
	body: unknown,
	schema: TSchema,
	responseByteLimit?: number,
) {
	return Effect.flatMap(GitHub, (github) =>
		Effect.flatMap(github.write(method, path, body, responseByteLimit), (response) => response.decode(schema)),
	);
}
