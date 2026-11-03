export interface Reply {
	readonly body: unknown;
	readonly headers?: Record<string, string>;
	readonly status?: number;
}

export interface Check {
	readonly conclusion: string | null;
	readonly name?: string;
	readonly required?: boolean;
	readonly status: string;
}

export interface CommitStatus {
	readonly required: boolean;
	readonly state: string;
}

export interface Pull {
	autoMerge: boolean;
	branch: string;
	mergeable: boolean | null;
	mergeableState: string;
	merged: boolean;
	sha: string;
	state: "open" | "closed";
	title: string;
}

export interface Received {
	readonly at: number;
	readonly authorization: string | undefined;
	readonly body: { readonly query?: string; readonly variables?: Record<string, unknown> } | undefined;
	readonly method: string;
	readonly path: string;
	readonly status: number;
}

export interface GraphqlQuery {
	readonly query: string;
	readonly variables: { readonly after?: string | null; readonly number: number; readonly sha?: string };
}

export const REPOSITORY = "/repos/acme/project";
export const OPEN_LIST = "/pulls?state=open&per_page=100";
export const QUEUE_REFS = "/git/matching-refs/heads/gh-readonly-queue/";
export const GRAPHQL = "/graphql";
export const REQUIRED_CHECKS = "/graphql required checks";

export function checksRoute(sha: string) {
	return `/commits/${sha}/check-runs?per_page=100&filter=latest`;
}

export function statusRoute(sha: string) {
	return `/commits/${sha}/status`;
}

export function pullDetail(pull: Pull, number: number) {
	return {
		"auto_merge": pull.autoMerge ? { "merge_method": "squash" } : null,
		head: { ref: pull.branch, sha: pull.sha },
		mergeable: pull.mergeable,
		"mergeable_state": pull.mergeableState,
		merged: pull.merged,
		number,
		state: pull.state,
		title: pull.title,
	};
}
