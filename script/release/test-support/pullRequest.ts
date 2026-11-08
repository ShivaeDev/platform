import { Clock, Effect, Exit, Fiber, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { GitHub } from "@shivaedev/github/github/service.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPlatform } from "#release/check.ts";
import { compareRelease } from "#release/compare.ts";
import { releaseGitHub } from "#release/gitHub.ts";
import { maintainPullRequest } from "#release/maintainPullRequest.ts";
import { preparePublish } from "#release/preparePublish.ts";
import { publishNotes } from "#release/publishNotes.ts";
import { publishPackages } from "#release/publishPackages.ts";
import { commitHook } from "#release/test-support/commitHook.ts";
import { isolatedTools } from "#release/test-support/isolatedTools.ts";
import { releasePrApi } from "#release/test-support/prApi.ts";
import { releasePrRepository } from "#release/test-support/prRepository.ts";
import { foreignMachine, releaseRegistry } from "#release/test-support/registry.ts";

const create = Effect.fn("ReleasePullRequest.create")(function* () {
	const repository = yield* releasePrRepository();
	const hook = yield* commitHook(repository.root);
	const registry = yield* releaseRegistry(repository.root);
	const api = releasePrApi(() => repository.git("ls-remote", "origin", "refs/heads/release/next").split("\t")[0] ?? "");
	const server = yield* api.serve;
	const context = yield* Layer.build(
		GitHub.layer.pipe(
			Layer.provide(
				Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubToken)(Option.none()), Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
			),
		),
	);
	return { ...repository, api, context, github: releaseGitHub("example/workspace"), hook, registry, server };
});

export const releasePullRequest = storyKit({
	create,
	layer: isolatedTools,
	name: "Release pull request automation",
	stages: ["main"],
	verbs: ({ api, context, git, github, hook, root, pushMain, registry, server }) => {
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
			alreadyPublished: (name: string, version: string) =>
				Effect.sync(() => {
					registry.alreadyPublished(name, version);
				}),
			blockCommit: hook.blockCommit,
			check: (base = "origin/main") => checkPlatform(root, base),
			close: () => github.close(1).pipe(Effect.provide(context)),
			failedComparison: (head: string) =>
				compareRelease(root, head).pipe(
					Effect.flip,
					Effect.map((failure) => failure._tag),
				),
			failedRun: () =>
				run().pipe(
					Effect.flip,
					Effect.map((failure) => failure._tag),
				),
			foreignMachine,
			git: (...args: readonly string[]) => Effect.sync(() => git(...args)),
			preparePush: (before: string) => preparePublish(root, git("rev-parse", "HEAD"), before),
			publish: (before: string) =>
				Effect.gen(function* () {
					const head = git("rev-parse", "HEAD");
					const published = yield* publishPackages(root, before);
					yield* publishNotes(root, "example/workspace", published, head);
				}).pipe(Effect.provide(context), Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
			publishAuthorizations: () => Effect.sync(registry.authorizations),
			publishedFile: (name: string, path: string) => registry.file(name, path),
			publishedPackages: () => Effect.sync(registry.publications),
			publishNotes: (base: string) =>
				Effect.gen(function* () {
					const plan = yield* checkPlatform(root, base);
					yield* publishNotes(
						root,
						"example/workspace",
						plan.releases.map(({ name, to }) => ({ name, version: to })),
						git("rev-parse", "HEAD"),
					);
				}).pipe(Effect.provide(context)),
			pushMain,
			queue: () =>
				Effect.sync(() => {
					api.state.queued = true;
				}),
			readGitHub: () => Effect.sync(() => structuredClone(api.state)),
			replyToSnapshot: (body: unknown, status: number) => server.scriptFault("graphql", { kind: "status", reply: { body, status } }),
			run,
			setCiRun: (status: string, conclusion: string | null = null) =>
				Effect.sync(() => {
					api.state.run = { conclusion, headSha: git("rev-parse", "origin/release/next"), status };
				}),
			startRun: () =>
				run().pipe(
					Effect.forkScoped,
					Effect.map((fiber) => ({
						interrupt: () => Fiber.interrupt(fiber),
						result: () => Fiber.await(fiber).pipe(Effect.map((exit) => (Exit.hasInterrupts(exit) ? "interrupted" : "completed"))),
					})),
				),
			waitForCommit: hook.waiting,
		};
	},
});
