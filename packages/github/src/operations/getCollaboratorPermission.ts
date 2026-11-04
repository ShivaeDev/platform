import { Effect } from "effect";
import { repository } from "#repositoryPaths.ts";
import { CollaboratorPermission } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export function getCollaboratorPermission(client: Representations) {
	return (owner: string, repo: string, username: string, byteLimit?: number) =>
		Effect.flatMap(client.read(`${repository(owner, repo)}/collaborators/${encodeURIComponent(username)}/permission`, byteLimit), (page) =>
			page.decode(CollaboratorPermission),
		);
}
