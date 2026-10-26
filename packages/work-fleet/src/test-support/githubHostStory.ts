import { Context, Effect, Layer } from "effect";
import type { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { githubResult } from "#host/githubResult.ts";
import { hostIntegrations } from "#host/integrations.ts";
import { MainSource } from "#host/mainSource.ts";
import { makeReportPublication, reportPublication } from "#host/reportPublication.ts";
import { FleetIntegrations } from "#policy.ts";
import { githubCliApi, syntheticGithub } from "#test/githubApi.ts";
import { resultFixture } from "#test/githubResult.ts";

const definition = {
	create: (): { requests: string[] } => ({ requests: [] }),
	name: "Fleet GitHub integration",
	stages: [] as const,
	verbs: (state: { requests: string[] }, story: { tell: (line: string) => void }) => ({
		api: (options: Parameters<typeof syntheticGithub>[0] = {}) =>
			Effect.gen(function* () {
				story.tell("connect Fleet's conditional GitHub client");
				const github = syntheticGithub(options);
				const client = Context.get(yield* Layer.build(github.layer), GithubApi);
				return { ...github, client };
			}),
		cli: (responses: ReadonlyMap<string, string>, status = 200) =>
			Effect.gen(function* () {
				story.tell("connect Fleet through GitHub HTTP");
				const cli = githubCliApi(responses, status);
				const api = Context.get(yield* Layer.build(cli.layer), GithubApi);
				return {
					adopt: (...args: Parameters<ReturnType<typeof githubResult>>) =>
						githubResult(resultFixture().host, api, Effect.succeed("example/repository"))(...args),
					checks: (result: Parameters<ReturnType<typeof githubChecks>>[0]) => githubChecks(api)(result),
					commands: cli.commands,
					published: (repository: string, branch: string) => reportPublication(api)(repository, branch),
				};
			}),
		delivery: (observation: Effect.Effect<unknown, ServiceUnavailable>, result: Parameters<ReturnType<typeof githubDelivery>>[0]) => {
			story.tell("observe delivery of the adopted pull request");
			return githubDelivery((pr) => {
				state.requests.push(pr);
				return observation;
			})(result);
		},
		deliveryRequests: () => state.requests,
		integrations: (configured = true) => {
			story.tell("load the host's result and check integrations");
			const fixture = resultFixture();
			const host = configured ? fixture.host : resolveHost("/synthetic/board", { provider: "local" });
			return FleetIntegrations.pipe(
				Effect.provide(hostIntegrations(host).pipe(Layer.provide([Layer.succeed(MainSource)(fixture.main), syntheticGithub().layer]))),
			);
		},
		publication: (response: string) => {
			story.tell("inspect GitHub publication evidence");
			return makeReportPublication(() => Effect.succeed(response))("example/project", "synthetic/research");
		},
		result: (options: Parameters<typeof resultFixture>[0] = {}) => {
			story.tell("configure the worker's GitHub result observations");
			return resultFixture(options);
		},
	}),
};
export const githubHost = storyKit(definition);
export const githubCliHost = storyKit({ ...definition, clock: "live" });
