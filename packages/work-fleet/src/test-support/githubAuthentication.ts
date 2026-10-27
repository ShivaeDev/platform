import { ConfigProvider, Context, Effect, Layer } from "effect";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { fakeGitHub } from "@shivaedev/github/test-support/fakeGitHub.ts";
import { telemetry } from "@shivaedev/github/test-support/telemetry.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GithubApi, githubApiLayer } from "#host/githubApi.ts";
import { githubCli } from "#test/githubCli.ts";

export const CLI_TOKEN = "fixture-cli-secret";
export const ENV_TOKEN = "fixture-env-secret";
export const FALLBACK_TOKEN = "fixture-fallback-secret";
const ENDPOINT = "repos/example/project/pulls/7";

export const githubAuthentication = storyKit({
	clock: "live",
	*create() {
		const fake = fakeGitHub();
		fake.reply(ENDPOINT, { number: 7 });
		const server = yield* fake.serve;
		return { cli: githubCli(new Map([["token", CLI_TOKEN]])), fake, recording: telemetry(), server };
	},
	name: "Fleet GitHub authentication",
	stages: [],
	verbs: ({ cli, fake, recording, server }, story) => ({
		commands: () => cli.commands,
		connect: (variables: Record<string, string>) => {
			story.tell("start Fleet's authenticated HTTP client");
			return Layer.build(
				githubApiLayer.pipe(
					Layer.provide(
						Layer.mergeAll(
							cli.layer,
							Layer.succeed(GitHubConfig)({ apiUrl: `${server.url}/` }),
							ConfigProvider.layer(ConfigProvider.fromEnvRecord(variables)),
						),
					),
				),
			).pipe(
				Effect.provide(recording.layer),
				Effect.map((context) => {
					const api = Context.get(context, GithubApi);
					return {
						observations: api.observations,
						read: () => api.get(ENDPOINT).pipe(Effect.withSpan("Fleet authentication read"), Effect.provide(recording.layer)),
					};
				}),
			);
		},
		limit: () => {
			story.tell("GitHub rate limits Fleet's next read");
			fake.reply(ENDPOINT, { message: "API rate limit exceeded" }, { headers: { "retry-after": "60" }, status: 403 });
		},
		requests: () => server.requests,
		telemetry: () => ({
			logs: recording.logs,
			spans: recording.spans.map(({ attributes, events, status }) => ({
				attributes: [...attributes],
				events: events.map(([name, , fields]) => ({ fields, name })),
				exit: status._tag === "Ended" ? status.exit : undefined,
			})),
		}),
	}),
});
