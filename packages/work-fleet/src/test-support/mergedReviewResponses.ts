import { BASE, PR } from "#test/githubResult.ts";

interface GithubFile {
	readonly filename: string;
	readonly "previous_filename"?: string;
}

export interface GithubState {
	base: string;
	changedFiles?: number;
	comparison?: { readonly files?: readonly GithubFile[] };
	failed: boolean;
	filePages?: readonly (readonly GithubFile[])[];
	head: string;
	legacyResult: boolean;
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
	paths: string[];
	pending: boolean;
	status: "OPEN" | "CLOSED" | "MERGED";
	unavailableReads: number;
}

export function githubResponses(state: GithubState): Readonly<Record<string, unknown>> {
	const merged = state.status === "MERGED";
	const conclusion = state.failed ? "failure" : "success";
	return {
		"/repos/example/repository/branches/main": [{ protected: false }],
		"/repos/example/repository/git/matching-refs/heads/synthetic%2Fone": [{ ref: "refs/heads/synthetic/one" }],
		"/repos/example/repository/pulls?state=all&head=example%3Asynthetic%2Fone&per_page=100": [
			[
				{
					"created_at": "2026-01-01T00:00:00Z",
					"html_url": PR,
					"merged_at": merged ? "2026-01-01T00:00:00Z" : null,
					state: state.status === "OPEN" ? "open" : "closed",
				},
			],
		],
		[`/repos/example/repository/compare/${state.base}...${state.head}?per_page=1`]: state.comparison ?? {
			files: state.paths.map((filename) => ({ filename })),
		},
		"/repos/example/repository/rules/branches/main": [
			[{ parameters: { "required_status_checks": [{ context: "test" }] }, type: "required_status_checks" }],
		],
		[`/repos/example/repository/commits/${state.head}/check-runs?per_page=100&filter=latest`]: [
			{
				"check_runs": [
					{
						conclusion: state.pending ? null : conclusion,
						"details_url": null,
						"head_sha": state.head,
						"html_url": `${PR}/checks`,
						name: "test",
						status: state.pending ? "queued" : "completed",
					},
				],
			},
		],
		[`/repos/example/repository/commits/${state.head}/status?per_page=100`]: [{ sha: state.head, statuses: [] }],
		"/repos/example/repository/pulls/7": {
			base: { ref: "main", sha: state.base },
			"changed_files": state.changedFiles ?? state.paths.length,
			head: { sha: state.head },
			"html_url": PR,
			"merge_commit_sha": merged ? BASE : null,
			mergeable: state.mergeable === "UNKNOWN" ? null : state.mergeable === "MERGEABLE",
			merged,
			"merged_at": merged ? "2026-01-01T00:00:00Z" : null,
			number: 7,
			state: state.status === "OPEN" ? "open" : "closed",
		},
	};
}

export function githubFilePage(state: GithubState, path: string) {
	const url = new URL(path, "http://localhost");
	if (url.pathname !== "/repos/example/repository/pulls/7/files") {
		return undefined;
	}
	const pages = state.filePages ?? [state.paths.map((filename) => ({ filename }))];
	const page = Number(url.searchParams.get("page") ?? "1");
	return { body: pages[page - 1], next: page < pages.length ? `${url.pathname}?per_page=100&page=${page + 1}` : undefined };
}
