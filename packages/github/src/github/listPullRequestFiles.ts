import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import { list } from "#github/list.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import type { RepositoryListOptions } from "#RepositoryListOptions.ts";
import { pathWithQuery, repository } from "#repositoryPaths.ts";
import { PullRequestFile } from "#repositorySchemas.ts";

export function listPullRequestFiles(state: GitHubState) {
	return Effect.fn("GitHub.listPullRequestFiles")(function* <E = ServiceUnavailable>(
		owner: string,
		repo: string,
		number: number,
		options?: RepositoryListOptions<E>,
	) {
		const pages = yield* list(state)(
			pathWithQuery(`${repository(owner, repo)}/pulls/${number}/files`, options),
			options?.beforeRequest,
			options?.responseByteLimit,
		);
		return decodePages(pages, PullRequestFile, options);
	});
}
