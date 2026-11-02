import { Effect, Schema, Stream } from "effect";
import { HttpClient } from "effect/http";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { artifacts } from "#artifacts.ts";
import { checkRuns } from "#checkRuns.ts";
import { GitHubConfig } from "#GitHubConfig.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { decodedPages, type ListOptions } from "#pagedLists.ts";
import { rateLimits } from "#rateLimits.ts";
import { repositoryReads } from "#repositoryReads.ts";
import { representations } from "#representations.ts";
import { requests } from "#requests.ts";
import { stickyComments } from "#stickyComments.ts";

export const GitHub = defineService({
	id: "@shivaedev/github/GitHub",
	initialize: Effect.gen(function* () {
		const config = yield* GitHubConfig;
		const rates = rateLimits();
		return {
			apiUrl: config.apiUrl,
			archive: yield* artifacts(config.apiUrl, rates),
			rates,
			request: yield* requests(rates),
			responseByteLimit: config.responseByteLimit,
		};
	}),
	methods: ({ apiUrl, archive, rates, request, responseByteLimit }) => {
		const { get, ...client } = representations(apiUrl, request, rates.resource, responseByteLimit);
		const reads = repositoryReads(client);
		return {
			bytes: (path: string, accept: string, limit: number) => Effect.map(request(get(path, accept), limit), (entry) => entry.bytes),
			...client,
			list: genericMethod(client.list),
			...archive,
			...stickyComments(client),
			...checkRuns(client),
			...reads,
			listCommits: genericMethod(reads.listCommits),
			listIssues: genericMethod(reads.listIssues),
			listPullRequestFiles: genericMethod(reads.listPullRequestFiles),
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

export function listPages<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	path: string,
	schema: TSchema,
	options?: ListOptions<E> | number,
) {
	return Stream.unwrap(Effect.map(GitHub, (github) => decodedPages(github, path, schema, options)));
}

export function list<TSchema extends Schema.Constraint, E = ServiceUnavailable>(path: string, schema: TSchema, options?: ListOptions<E> | number) {
	return listPages(path, schema, options).pipe(Stream.flatMap((page) => Stream.fromIterable(page.items)));
}

export function listBounded<TSchema extends Schema.Constraint, E = ServiceUnavailable>(
	path: string,
	schema: TSchema,
	pageCap: number,
	options?: ListOptions<E> | number,
) {
	return listPages(path, schema, options).pipe(
		Stream.take(pageCap),
		Stream.runCollect,
		Effect.map((pages) => ({
			items: pages.flatMap((page) => page.items),
			skipped: pages.reduce((count, page) => count + page.skipped, 0),
			truncated: pages.at(-1)?.hasNext ?? false,
		})),
	);
}

type WriteMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export function write<TSchema extends Schema.Constraint>(
	method: WriteMethod,
	path: string,
	body: unknown,
	schema: TSchema,
	responseByteLimit?: number,
): ReturnType<typeof writeDecoded<TSchema>>;
export function write(method: WriteMethod, path: string, body?: unknown): ReturnType<typeof writeDecoded<typeof Schema.Void>>;
export function write(method: WriteMethod, path: string, body?: unknown, schema: Schema.Constraint = Schema.Void, responseByteLimit?: number) {
	return writeDecoded(method, path, body, schema, responseByteLimit);
}

function writeDecoded<TSchema extends Schema.Constraint>(
	method: WriteMethod,
	path: string,
	body: unknown,
	schema: TSchema,
	responseByteLimit?: number,
) {
	return Effect.flatMap(GitHub, (github) =>
		Effect.flatMap(github.write(method, path, body, responseByteLimit), (response) => response.decode(schema)),
	);
}
