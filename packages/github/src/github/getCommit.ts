import { Effect } from "effect";
import { CommitDetail } from "#gitSchemas.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import { repository } from "#repositoryPaths.ts";
import { read } from "./read.ts";

export function getCommit(state: GitHubState) {
	return Effect.fn("GitHub.getCommit")(function* (owner: string, repo: string, ref: string, byteLimit?: number) {
		return yield* Effect.flatMap(read(state)(`${repository(owner, repo)}/commits/${encodeURIComponent(ref)}`, byteLimit), (page) =>
			page.decode(CommitDetail),
		);
	});
}
