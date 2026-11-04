import { Effect } from "effect";
import { repository } from "#repositoryPaths.ts";
import { Issue } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export function getIssue(client: Representations) {
	return (owner: string, repo: string, number: number, byteLimit?: number) =>
		Effect.flatMap(client.read(`${repository(owner, repo)}/issues/${number}`, byteLimit), (page) => page.decode(Issue));
}
