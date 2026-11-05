import { Effect } from "effect";
import type { GitHubState } from "#initializeGitHub.ts";
import { repository } from "#repositoryPaths.ts";
import { Issue } from "#repositorySchemas.ts";
import { read } from "./read.ts";

export function getIssue(state: GitHubState) {
	return Effect.fn("GitHub.getIssue")(function* (owner: string, repo: string, number: number, byteLimit?: number) {
		return yield* Effect.flatMap(read(state)(`${repository(owner, repo)}/issues/${number}`, byteLimit), (page) => page.decode(Issue));
	});
}
