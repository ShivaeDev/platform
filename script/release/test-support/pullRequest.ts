import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
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
		git: (...args: readonly string[]) => Effect.sync(() => git(...args)),
		pushMain,
		queue: () =>
			Effect.sync(() => {
				api.state.queued = true;
			}),
		readGitHub: () => Effect.sync(() => structuredClone(api.state)),
		run: () => maintainPullRequest(root, github),
	}),
});
