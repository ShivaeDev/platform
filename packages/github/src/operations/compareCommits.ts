import { Effect } from "effect";
import { Comparison } from "#gitSchemas.ts";
import { repository } from "#repositoryPaths.ts";
import type { Representations } from "#representations.ts";

export function compareCommits(client: Representations) {
	return (owner: string, repo: string, base: string, head: string, byteLimit?: number) =>
		Effect.flatMap(client.read(`${repository(owner, repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, byteLimit), (page) =>
			page.decode(Comparison),
		);
}
