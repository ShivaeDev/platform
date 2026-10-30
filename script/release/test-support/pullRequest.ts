import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPlatform } from "#release/check.ts";
import { releaseGitHub } from "#release/gitHub.ts";
import { maintainPullRequest } from "#release/maintainPullRequest.ts";
import { releasePrApi } from "./prApi.ts";
import { releasePrRepository } from "./prRepository.ts";

const create = Effect.fn("ReleasePullRequest.create")(function* () {
	const repository = yield* releasePrRepository();
	const api = releasePrApi(() => repository.git("ls-remote", "origin", "refs/heads/release/next").split("\t")[0] ?? "");
	const server = yield* api.serve;
	const context = yield* Layer.build(
		GitHub.layer.pipe(
			Layer.provide(
				Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubToken)(Option.none()), Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
			),
		),
	);
	return { ...repository, api, context, github: releaseGitHub("example/workspace"), server };
});

export const releasePullRequest = storyKit({
	clock: "live",
	create,
	layer: NodeServices.layer,
	name: "Release pull request automation",
	stages: ["main"],
	verbs: ({ api, context, git, github, root, pushMain, server }) => {
		const run = Effect.fn("ReleasePullRequest.run")(function* (date?: string) {
			const clock = yield* Clock.Clock;
			return yield* maintainPullRequest(root, github).pipe(
				Effect.provide(context),
				Effect.provideService(Clock.Clock, {
					currentTimeMillis: date === undefined ? clock.currentTimeMillis : Effect.succeed(Date.parse(date)),
					currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
					currentTimeNanos: clock.currentTimeNanos,
					currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
					monotonicTimeNanos: clock.monotonicTimeNanos,
					monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
					sleep: (duration) => clock.sleep(duration),
				}),
			);
		});
		return {
			check: () => checkPlatform(root, "origin/main"),
			close: () => github.close(1).pipe(Effect.provide(context)),
			failedRun: () =>
				run().pipe(
					Effect.flip,
					Effect.map((failure) => failure._tag),
				),
			git: (...args: readonly string[]) => Effect.sync(() => git(...args)),
			pushMain,
			queue: () =>
				Effect.sync(() => {
					api.state.queued = true;
				}),
			readGitHub: () => Effect.sync(() => structuredClone(api.state)),
			replyToSnapshot: (body: unknown, status: number) => server.replyOnce("graphql", { body, status }),
			run,
			setCiRun: (status: string, conclusion: string | null = null) =>
				Effect.sync(() => {
					api.state.run = { conclusion, headSha: git("rev-parse", "origin/release/next"), status };
				}),
		};
	},
});
