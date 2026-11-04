import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodedPages } from "#pagedLists.ts";
import { pathWithQuery, repository } from "#repositoryPaths.ts";
import type { RepositoryListOptions } from "#repositoryReads.ts";
import { Issue } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export function listIssues(client: Representations) {
	return <E = ServiceUnavailable>(owner: string, repo: string, options?: RepositoryListOptions<E>) =>
		Effect.succeed(decodedPages(client, pathWithQuery(`${repository(owner, repo)}/issues`, options), Issue, options));
}
