import type { FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { ChangeResult } from "#policy.ts";

export const RELEASE_PR = "https://github.com/example/project/pull/99";
export const RELEASE_HEAD = "b".repeat(40);

export function releaseWindowApi(result: (number: string) => typeof ChangeResult.Type | undefined) {
	let release: { branch: string; base: string; draft: boolean; state: string } | undefined;
	let run: { id: number; status: string; conclusion: string | null; head: string } | undefined;
	const files = new Map<string, string>();
	const routes = {
		ci: {
			path: "/repos/example/project/actions/workflows/ci.yml/runs",
			reply: ({ query }) => ({
				body: {
					"workflow_runs":
						query.get("event") === "pull_request" && query.get("head_sha") === run?.head
							? [{ conclusion: run.conclusion, "head_sha": run.head, id: run.id, "run_attempt": 1, status: run.status }]
							: [],
				},
			}),
		},
		files: {
			path: "/repos/example/project/pulls/:number/files",
			reply: ({ params }) => ({
				body: result(params.number ?? "")?.paths.map((filename) => ({ filename, status: files.get(filename) ?? "added" })) ?? [],
			}),
		},
		releases: {
			path: "/repos/example/project/pulls",
			reply: ({ query }) => ({
				body:
					release !== undefined
					&& release.state === query.get("state")
					&& `example:${release.branch}` === query.get("head")
					&& release.base === query.get("base")
						? [{ draft: release.draft, head: { sha: RELEASE_HEAD }, "html_url": RELEASE_PR, "node_id": "99" }]
						: [],
			}),
		},
	} satisfies Record<string, FakeHttpRoute>;
	return {
		ciRun: (status: string, conclusion: string | null, head: string) => {
			run = { conclusion, head, id: (run?.id ?? 0) + 1, status };
		},
		closeRelease: (state: "closed" | "merged") => {
			if (release === undefined) {
				throw new Error("No release PR is open");
			}
			release.state = state;
		},
		fileStatus: (path: string, status: string) => files.set(path, status),
		openRelease: (options: { branch?: string; base?: string; draft?: boolean } = {}) => {
			release = { base: "main", branch: "release/next", draft: false, ...options, state: "open" };
		},
		routes,
	};
}
