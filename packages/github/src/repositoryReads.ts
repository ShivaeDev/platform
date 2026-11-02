import { Effect } from "effect";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { Commit, CommitDetail, Comparison, GitTree } from "#gitSchemas.ts";
import { decodedPages, type ListOptions } from "#pagedLists.ts";
import { CollaboratorPermission, Issue, PullRequestFile, User } from "#repositorySchemas.ts";
import type { Representations } from "#representations.ts";

export interface RepositoryListOptions<E = ServiceUnavailable> extends ListOptions<E> {
	readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
}

export function repositoryReads(client: Representations) {
	function repository(owner: string, repo: string) {
		return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
	}
	function pathWithQuery<E>(path: string, options?: RepositoryListOptions<E>) {
		const query = new URLSearchParams({ "per_page": "100" });
		for (const [key, value] of Object.entries(options?.query ?? {})) {
			if (value !== undefined) {
				query.set(key, String(value));
			}
		}
		return `${path}?${query}`;
	}
	return {
		compareCommits: (owner: string, repo: string, base: string, head: string, byteLimit?: number) =>
			Effect.flatMap(client.read(`${repository(owner, repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, byteLimit), (page) =>
				page.decode(Comparison),
			),
		getCollaboratorPermission: (owner: string, repo: string, username: string, byteLimit?: number) =>
			Effect.flatMap(client.read(`${repository(owner, repo)}/collaborators/${encodeURIComponent(username)}/permission`, byteLimit), (page) =>
				page.decode(CollaboratorPermission),
			),
		getCommit: (owner: string, repo: string, ref: string, byteLimit?: number) =>
			Effect.flatMap(client.read(`${repository(owner, repo)}/commits/${encodeURIComponent(ref)}`, byteLimit), (page) => page.decode(CommitDetail)),
		getIssue: (owner: string, repo: string, number: number, byteLimit?: number) =>
			Effect.flatMap(client.read(`${repository(owner, repo)}/issues/${number}`, byteLimit), (page) => page.decode(Issue)),
		getTree: (
			owner: string,
			repo: string,
			sha: string,
			options?: { readonly recursive?: boolean; readonly responseByteLimit?: number | undefined },
		) =>
			Effect.flatMap(
				client.read(
					`${repository(owner, repo)}/git/trees/${encodeURIComponent(sha)}${options?.recursive ? "?recursive=1" : ""}`,
					options?.responseByteLimit,
				),
				(page) => page.decode(GitTree),
			),
		getUser: (username?: string, byteLimit?: number) =>
			Effect.flatMap(client.read(username === undefined ? "/user" : `/users/${encodeURIComponent(username)}`, byteLimit), (page) =>
				page.decode(User),
			),
		listCommits: <E = ServiceUnavailable>(owner: string, repo: string, options?: RepositoryListOptions<E>) =>
			Effect.succeed(decodedPages(client, pathWithQuery(`${repository(owner, repo)}/commits`, options), Commit, options)),
		listIssues: <E = ServiceUnavailable>(owner: string, repo: string, options?: RepositoryListOptions<E>) =>
			Effect.succeed(decodedPages(client, pathWithQuery(`${repository(owner, repo)}/issues`, options), Issue, options)),
		listPullRequestFiles: <E = ServiceUnavailable>(owner: string, repo: string, number: number, options?: RepositoryListOptions<E>) =>
			Effect.succeed(decodedPages(client, pathWithQuery(`${repository(owner, repo)}/pulls/${number}/files`, options), PullRequestFile, options)),
	};
}
