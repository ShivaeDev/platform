import { Effect } from "effect";
import { read } from "#github/read.ts";
import { GitTree } from "#gitSchemas.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { repository } from "#repositoryPaths.ts";

export function getTree(state: GitHubState) {
	return Effect.fn("GitHub.getTree")(function* (
		owner: string,
		repo: string,
		sha: string,
		options?: { readonly recursive?: boolean; readonly responseByteLimit?: number | undefined },
	) {
		return yield* Effect.flatMap(
			read(state)(
				`${repository(owner, repo)}/git/trees/${encodeURIComponent(sha)}${options?.recursive ? "?recursive=1" : ""}`,
				options?.responseByteLimit,
			),
			(page) => page.decode(GitTree),
		);
	});
}
