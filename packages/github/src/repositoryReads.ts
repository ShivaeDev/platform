import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { compareCommits } from "#operations/compareCommits.ts";
import { getCollaboratorPermission } from "#operations/getCollaboratorPermission.ts";
import { getCommit } from "#operations/getCommit.ts";
import { getIssue } from "#operations/getIssue.ts";
import { getTree } from "#operations/getTree.ts";
import { getUser } from "#operations/getUser.ts";
import { listCommits } from "#operations/listCommits.ts";
import { listIssues } from "#operations/listIssues.ts";
import { listPullRequestFiles } from "#operations/listPullRequestFiles.ts";
import type { ListOptions } from "#pagedLists.ts";
import type { Representations } from "#representations.ts";

export interface RepositoryListOptions<E = ServiceUnavailable> extends ListOptions<E> {
	readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
}

export function repositoryReads(client: Representations) {
	return {
		compareCommits: compareCommits(client),
		getCollaboratorPermission: getCollaboratorPermission(client),
		getCommit: getCommit(client),
		getIssue: getIssue(client),
		getTree: getTree(client),
		getUser: getUser(client),
		listCommits: listCommits(client),
		listIssues: listIssues(client),
		listPullRequestFiles: listPullRequestFiles(client),
	};
}
