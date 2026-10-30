import type { Reply } from "./server.ts";

export interface RequiredContext {
	__typename: string;
	context?: string;
	id?: string;
	isRequired: boolean;
}
export function requiredPage(nodes: readonly RequiredContext[], next: string | null = null): Reply {
	return {
		body: {
			data: {
				repository: {
					object: {
						statusCheckRollup: {
							contexts: { nodes, pageInfo: { endCursor: next, hasNextPage: next !== null } },
						},
					},
				},
			},
		},
	};
}
export function requiredChecks() {
	const nodes = new Map<string, RequiredContext[]>();
	const pages = new Map<string | null, Reply>();
	return {
		nodes,
		reply: (sha: string, after: string | null) => pages.get(after) ?? requiredPage(nodes.get(sha) ?? []),
		seed: (sha: string) => {
			if (!nodes.has(sha)) {
				nodes.set(sha, [
					{ __typename: "CheckRun", id: "check", isRequired: true },
					{ __typename: "StatusContext", context: "ci", isRequired: true },
				]);
			}
		},
		setPage: (after: string | null, response: Reply) => pages.set(after, response),
	};
}
