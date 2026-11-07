import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import { list } from "#github/list.ts";
import { Commit } from "#gitSchemas.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import type { RepositoryListOptions } from "#RepositoryListOptions.ts";
import { pathWithQuery, repository } from "#repositoryPaths.ts";

export function listCommits(state: GitHubState) {
	return Effect.fn("GitHub.listCommits")(function* <E = ServiceUnavailable>(owner: string, repo: string, options?: RepositoryListOptions<E>) {
		const pages = yield* list(state)(
			pathWithQuery(`${repository(owner, repo)}/commits`, options),
			options?.beforeRequest,
			options?.responseByteLimit,
		);
		return decodePages(pages, Commit, options);
	});
}
