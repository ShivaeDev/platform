import { NodeServices } from "@effect/platform-node";
import { Clock, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { checkPlatform } from "#release/check.ts";
import { releaseGitHub } from "#release/gitHub.ts";
import { maintainPullRequest } from "#release/maintainPullRequest.ts";
import { releasePrApi } from "./prApi.ts";
import { releasePrRepository } from "./prRepository.ts";

const create = Effect.fn("ReleasePullRequest.create")(function* () {
	const repository = yield* releasePrRepository();
	const api = releasePrApi(() => repository.git("ls-remote", "origin", "refs/heads/release/next").split("\t")[0] ?? "");
	return { ...repository, api, github: releaseGitHub("example/workspace", api.request) };
});

export const releasePullRequest = storyKit({
	clock: "live",
	create,
	layer: NodeServices.layer,
	name: "Release pull request automation",
	stages: ["main"],
	verbs: ({ api, git, github, root, pushMain }) => ({
		check: () => checkPlatform(root, "origin/main"),
		close: () => Effect.sync(() => github.close(1)),
		git: (...args: readonly string[]) => Effect.sync(() => git(...args)),
		pushMain,
		queue: () =>
			Effect.sync(() => {
				api.state.queued = true;
			}),
		readGitHub: () => Effect.sync(() => structuredClone(api.state)),
		run: Effect.fn("ReleasePullRequest.run")(function* (date?: string) {
			const clock = yield* Clock.Clock;
			return yield* maintainPullRequest(root, github).pipe(
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
		}),
	}),
});
