import { Effect } from "effect";
import { GitTree } from "#gitSchemas.ts";
import { repository } from "#repositoryPaths.ts";
import type { Representations } from "#representations.ts";

export function getTree(client: Representations) {
	return (owner: string, repo: string, sha: string, options?: { readonly recursive?: boolean; readonly responseByteLimit?: number | undefined }) =>
		Effect.flatMap(
			client.read(
				`${repository(owner, repo)}/git/trees/${encodeURIComponent(sha)}${options?.recursive ? "?recursive=1" : ""}`,
				options?.responseByteLimit,
			),
			(page) => page.decode(GitTree),
		);
}
