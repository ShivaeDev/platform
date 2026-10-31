import { Context, Duration, Effect, Layer } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { TestClock } from "effect/testing";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { failureContext } from "#engine/failureContext.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { githubRateLimited } from "#host/githubRateLimit.ts";
import { githubResult } from "#host/githubResult.ts";
import { hostIntegrations } from "#host/integrations.ts";
import { MainSource } from "#host/mainSource.ts";
import { makeReportPublication, reportPublication } from "#host/reportPublication.ts";
import { FleetIntegrations } from "#policy.ts";
import { githubCliApi, syntheticGithub } from "#test/githubApi.ts";
import { resultFixture } from "#test/githubResult.ts";
import { described } from "#test/refusal.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

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
				return {
					...github,
					client,
					pagesOf: (path: string) => outcome(client.pages(path)),
					read: (path: string) => outcome(client.get(path)),
					statuses: () => github.requests.map(({ endpoint, status }) => `${status} ${endpoint}`),
				};
			}),
		cli: (responses: ReadonlyMap<string, string>, status: number = HttpStatus.fromLiteral("OK")) =>
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
		deliveryOutcome: (observation: Effect.Effect<unknown, ServiceUnavailable>, result: Parameters<ReturnType<typeof githubDelivery>>[0]) => {
			story.tell("observe delivery of the adopted pull request");
			return githubDelivery((pr) => {
				state.requests.push(pr);
				return observation;
			})(result).pipe(
				Effect.match({
					onFailure: (error) => {
						const { code, head, mainRevision } = failureContext(error);
						const context = [
							code,
							head === undefined ? undefined : `head ${head}`,
							mainRevision === undefined ? undefined : `main ${mainRevision}`,
						].filter((part) => part !== undefined);
						return context.length === 0 ? described(error) : `${described(error)} (${context.join(", ")})`;
					},
					onSuccess: (delivered) => (delivered === undefined ? "waiting" : `merged ${delivered.revision} at ${delivered.head} for ${delivered.url}`),
				}),
			);
		},
		deliveryRequests: () => state.requests,
		elapse: (duration: Duration.Input) => {
			story.tell(`${Duration.format(Duration.fromInputUnsafe(duration))} pass on the test clock`);
			return TestClock.adjust(duration);
		},
		integrations: (configured = true) => {
			story.tell("load the host's result and check integrations");
			const fixture = resultFixture();
			const host = configured ? fixture.host : resolveHost("/synthetic/board", { database: syntheticDatabase, provider: "local" });
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

function outcome(read: Effect.Effect<string, unknown>) {
	return read.pipe(
		Effect.match({
			onFailure: (error) => (githubRateLimited(error) ? `limited until ${failureContext(error).retryAt}` : described(error)),
			onSuccess: (body): unknown => JSON.parse(body),
		}),
	);
}
