import { Context, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { fakeGitHub } from "@shivaedev/github/test-support/fakeGitHub.ts";
import { GithubApi } from "#host/githubApi.ts";

export interface ScriptedGithubResponse {
	readonly body: unknown;
	readonly headers?: Readonly<Record<string, string>>;
	readonly status?: number;
}
export interface GithubRequest {
	readonly endpoint: string;
	readonly etag: string | undefined;
	readonly method: string;
	readonly status: number;
}

export const GITHUB_RESET = 1_800_003_600;

export function githubHttpLayer(origin: string) {
	return GitHub.layer.pipe(
		Layer.provide(
			Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubToken)(Option.none()), Layer.succeed(GitHubConfig)({ apiUrl: `${origin}/` })),
		),
	);
}

export function syntheticGithub(options: { readonly limit?: number; readonly remaining?: number; readonly reset?: number } = {}) {
	const fake = fakeGitHub(options);
	const client = Layer.unwrap(Effect.map(fake.serve.pipe(Effect.orDie), (server) => githubHttpLayer(server.url)));
	return { ...fake, layer: GithubApi.layer.pipe(Layer.provide(client)) };
}

export function githubCliApi(bodies: ReadonlyMap<string, string>, status = 200) {
	const github = syntheticGithub();
	for (const [endpoint, body] of bodies) {
		github.reply(endpoint, body, { status });
	}
	return { ...github, commands: github.requests };
}

export function unslurped(responses: ReadonlyMap<string, string>) {
	return new Map(
		[...responses].map(([endpoint, pages]) => {
			const [page, ...rest] = JSON.parse(pages);
			if (rest.length > 0) {
				throw new Error(`Synthetic ${endpoint} needs Link headers for more than one page`);
			}
			return [endpoint, JSON.stringify(page)];
		}),
	);
}

export const httpGithubApi = Effect.fn("Test.httpGithubApi")(function* (origin: string) {
	return Context.get(yield* Layer.build(GithubApi.layer.pipe(Layer.provide(githubHttpLayer(origin)))), GithubApi);
});
