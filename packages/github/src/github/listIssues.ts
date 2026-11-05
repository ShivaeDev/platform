import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { decodePages } from "#decodePages.ts";
import type { GitHubState } from "#initializeGitHub.ts";
import type { RepositoryListOptions } from "#RepositoryListOptions.ts";
import { pathWithQuery, repository } from "#repositoryPaths.ts";
import { Issue } from "#repositorySchemas.ts";
import { list } from "./list.ts";

export function listIssues(state: GitHubState) {
	return Effect.fn("GitHub.listIssues")(function* <E = ServiceUnavailable>(owner: string, repo: string, options?: RepositoryListOptions<E>) {
		const pages = yield* list(state)(pathWithQuery(`${repository(owner, repo)}/issues`, options), options?.beforeRequest, options?.responseByteLimit);
		return decodePages(pages, Issue, options);
	});
}
