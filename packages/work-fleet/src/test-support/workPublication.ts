import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubPublication } from "#host/githubPublication.ts";
import type { BoardWork } from "#policy.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

export const WORK_BRANCH = "synthetic/one";
export const WORK_PR = workPr(0);

type PullRequestState = "open" | "closed" | "merged";

export function workPr(index: number) {
	return `https://github.com/example/repository/pull/${7 + index}`;
}

export function workPublication() {
	const github = syntheticGithub();
	const refs = `repos/example/repository/git/matching-refs/heads/${encodeURIComponent(WORK_BRANCH)}`;
	const pulls = `repos/example/repository/pulls?state=all&head=${encodeURIComponent(`example:${WORK_BRANCH}`)}&per_page=100`;
	const host = resolveHost("/synthetic", {
		database: syntheticDatabase,
		provider: "cloud",
		worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
	});
	github.reply(refs, []);
	github.reply(pulls, []);
	return {
		branch: () => github.reply(refs, [{ ref: `refs/heads/${WORK_BRANCH}` }]),
		neighbour: () => github.reply(refs, [{ ref: `refs/heads/${WORK_BRANCH}-other` }]),
		pullRequests: (...states: readonly PullRequestState[]) => {
			github.reply(
				pulls,
				states.map((state, index) => ({
					"html_url": workPr(index),
					"merged_at": state === "merged" ? "2026-01-01T00:00:00Z" : null,
					state: state === "open" ? "open" : "closed",
				})),
			);
		},
		pullsUnavailable: () => {
			github.reply(pulls, {}, { status: HttpStatus.fromLiteral("ServiceUnavailable") });
		},
		query: (work: BoardWork) =>
			Effect.gen(function* () {
				return yield* githubPublication(host, yield* GithubApi, Effect.succeed("example/repository"))(work);
			}).pipe(Effect.provide(github.layer)),
		unavailable: () => github.reply(refs, {}, { status: HttpStatus.fromLiteral("ServiceUnavailable") }),
	};
}
