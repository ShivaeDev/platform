import { Effect } from "effect";
import { Comparison } from "#gitSchemas.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { repository } from "#repositoryPaths.ts";
import { read } from "./read.ts";

export function compareCommits(state: GitHubState) {
	return Effect.fn("GitHub.compareCommits")(function* (owner: string, repo: string, base: string, head: string, byteLimit?: number) {
		return yield* Effect.flatMap(
			read(state)(`${repository(owner, repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, byteLimit),
			(page) => page.decode(Comparison),
		);
	});
}
