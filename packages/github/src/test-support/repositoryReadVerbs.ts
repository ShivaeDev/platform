import type { Context } from "effect";
import { Effect, Stream } from "effect";
import type { GitHub } from "#GitHub.ts";
import { answered } from "./outcome.ts";

export type RepositoryRead = "authenticated user" | "issue" | "compare" | "tree" | "commit" | "permission" | "user";
export type RepositoryList = "issues" | "files" | "commits";

export function repositoryReadVerbs(client: Context.Service.Shape<typeof GitHub>, tell: (line: string) => void) {
	const reads = {
		"authenticated user": (responseByteLimit?: number) => client.getUser(undefined, responseByteLimit),
		commit: (responseByteLimit?: number) => client.getCommit("acme", "widgets", "feature/widgets", responseByteLimit),
		compare: (responseByteLimit?: number) => client.compareCommits("acme", "widgets", "main", "feature/widgets", responseByteLimit),
		issue: (responseByteLimit?: number) => client.getIssue("acme", "widgets", 3, responseByteLimit),
		permission: (responseByteLimit?: number) => client.getCollaboratorPermission("acme", "widgets", "alice", responseByteLimit),
		tree: (responseByteLimit?: number) => client.getTree("acme", "widgets", "feature/widgets", { recursive: true, responseByteLimit }),
		user: (responseByteLimit?: number) => client.getUser("alice", responseByteLimit),
	};
	const lists: Record<RepositoryList, (responseByteLimit?: number) => Effect.Effect<unknown, unknown>> = {
		commits: (responseByteLimit?: number) =>
			Effect.flatMap(client.listCommits("acme", "widgets", { query: { sha: "feature/widgets" }, responseByteLimit }), Stream.runCollect),
		files: (responseByteLimit?: number) =>
			Effect.flatMap(client.listPullRequestFiles("acme", "widgets", 3, { responseByteLimit }), Stream.runCollect),
		issues: (responseByteLimit?: number) =>
			Effect.flatMap(client.listIssues("acme", "widgets", { query: { state: "all" }, responseByteLimit }), Stream.runCollect),
	};
	return {
		listRepository: (kind: RepositoryList, responseByteLimit?: number) =>
			Effect.suspend(() => {
				tell(`the client lists repository ${kind}`);
				return answered(lists[kind](responseByteLimit));
			}),
		readRepository: (kind: RepositoryRead, responseByteLimit?: number) =>
			Effect.suspend(() => {
				tell(`the client reads the repository ${kind}`);
				return answered<unknown, unknown, never>(reads[kind](responseByteLimit));
			}),
	};
}
