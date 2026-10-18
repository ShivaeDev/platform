import { Effect } from "effect";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubPublication } from "#host/githubPublication.ts";
import type { BoardWork } from "#policy.ts";
import { syntheticGithub } from "#test/githubApi.ts";

export const WORK_BRANCH = "synthetic/one";
export const WORK_PR = "https://github.com/example/repository/pull/7";

export function workPublication() {
	const github = syntheticGithub();
	const refs = `repos/example/repository/git/matching-refs/heads/${encodeURIComponent(WORK_BRANCH)}`;
	const pulls = `repos/example/repository/pulls?state=open&head=${encodeURIComponent(`example:${WORK_BRANCH}`)}&per_page=100`;
	const host = resolveHost("/synthetic", { provider: "cloud", worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" } });
	github.reply(refs, []);
	github.reply(pulls, []);
	return {
		branch: () => github.reply(refs, [{ ref: `refs/heads/${WORK_BRANCH}` }]),
		neighbour: () => github.reply(refs, [{ ref: `refs/heads/${WORK_BRANCH}-other` }]),
		pullRequest: () => github.reply(pulls, [{ "html_url": WORK_PR }]),
		pullsUnavailable: () => github.reply(pulls, {}, { status: 503 }),
		query: (work: BoardWork) =>
			Effect.gen(function* () {
				return yield* githubPublication(host, yield* GithubApi, Effect.succeed("example/repository"))(work);
			}).pipe(Effect.provide(github.layer)),
		unavailable: () => github.reply(refs, {}, { status: 503 }),
	};
}
