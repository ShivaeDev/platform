import type { FakeHttpRoute } from "@shivaedev/test-story/server/fakeHttpService.ts";
import type { ChangeResult } from "#policy.ts";

export const RELEASE_PR = "https://github.com/example/project/pull/99";
export const RELEASE_HEAD = "b".repeat(40);

export function releaseWindowApi(result: (number: string) => typeof ChangeResult.Type | undefined) {
	let release: { branch: string; base: string; draft: boolean; state: string } | undefined;
	const files = new Map<string, string>();
	const routes = {
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
						? [{ draft: release.draft, head: { sha: RELEASE_HEAD }, "html_url": RELEASE_PR }]
						: [],
			}),
		},
	} satisfies Record<string, FakeHttpRoute>;
	return {
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
