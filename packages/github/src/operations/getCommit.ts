import { Effect } from "effect";
import { CommitDetail } from "#gitSchemas.ts";
import { repository } from "#repositoryPaths.ts";
import type { Representations } from "#representations.ts";

export function getCommit(client: Representations) {
	return (owner: string, repo: string, ref: string, byteLimit?: number) =>
		Effect.flatMap(client.read(`${repository(owner, repo)}/commits/${encodeURIComponent(ref)}`, byteLimit), (page) => page.decode(CommitDetail));
}
