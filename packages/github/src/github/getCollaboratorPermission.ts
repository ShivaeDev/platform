import { Effect } from "effect";
import type { GitHubState } from "#initializeGitHub.ts";
import { repository } from "#repositoryPaths.ts";
import { CollaboratorPermission } from "#repositorySchemas.ts";
import { read } from "./read.ts";

export function getCollaboratorPermission(state: GitHubState) {
	return Effect.fn("GitHub.getCollaboratorPermission")(function* (owner: string, repo: string, username: string, byteLimit?: number) {
		return yield* Effect.flatMap(
			read(state)(`${repository(owner, repo)}/collaborators/${encodeURIComponent(username)}/permission`, byteLimit),
			(page) => page.decode(CollaboratorPermission),
		);
	});
}
