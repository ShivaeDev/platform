import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodedPages } from "#pagedLists.ts";
import { pathWithQuery, repository } from "#repositoryPaths.ts";
import type { RepositoryListOptions } from "#repositoryReads.ts";
import { PullRequestFile } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export function listPullRequestFiles(client: Representations) {
	return <E = ServiceUnavailable>(owner: string, repo: string, number: number, options?: RepositoryListOptions<E>) =>
		Effect.succeed(decodedPages(client, pathWithQuery(`${repository(owner, repo)}/pulls/${number}/files`, options), PullRequestFile, options));
}
