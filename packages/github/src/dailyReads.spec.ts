import { expect } from "vitest";
import { github } from "#test/github.ts";
import { dailyRepositoryReads } from "#test/repositoryReadTraits.ts";
import type { RepositoryList, RepositoryRead } from "#test/repositoryReadVerbs.ts";

const user = { avatarUrl: "https://avatars.example/alice", htmlUrl: "https://github.com/alice", id: 7, login: "alice", type: "User" };
const file = { additions: 2, changes: 3, deletions: 1, filename: "new.ts", previousFilename: "old.ts", sha: "file-sha", status: "renamed" };
const commit = {
	author: null,
	commit: { author: null, committer: null, message: "Ship widgets", tree: { sha: "tree-sha", url: "https://api.github.com/tree" } },
	committer: null,
	htmlUrl: "https://github.com/acme/widgets/commit/head",
	parents: [{ sha: "base-sha", url: "https://api.github.com/commit/base" }],
	sha: "head-sha",
};
const issue = {
	body: null,
	closedAt: null,
	createdAt: "2026-10-11T12:00:00Z",
	htmlUrl: "https://github.com/acme/widgets/issues/3",
	id: 30,
	labels: [{ name: "ready" }],
	number: 3,
	state: "open",
	title: "Ship widgets",
	updatedAt: "2026-10-12T12:00:00Z",
	user,
};
const reads: ReadonlyArray<readonly [RepositoryRead, unknown]> = [
	["issue", issue],
	["user", user],
	["authenticated user", user],
	["permission", { permission: "write", roleName: "maintain", user }],
	["compare", { aheadBy: 1, behindBy: 0, commits: [commit], files: [file], status: "ahead", totalCommits: 1 }],
	["commit", { ...commit, files: [file], stats: { additions: 2, deletions: 1, total: 3 } }],
	[
		"tree",
		{
			sha: "tree-sha",
			tree: [{ mode: "160000", path: "vendor/widgets", sha: "submodule-sha", type: "commit" }],
			truncated: true,
			url: "https://api.github.com/tree",
		},
	],
];
for (const [kind, expected] of reads) {
	github.it(`the typed ${kind} read returns decoded GitHub data`, [dailyRepositoryReads], function* ({ readRepository }) {
		expect(yield* readRepository(kind)).toEqual(expected);
	});
	github.it(`the typed ${kind} read enforces its caller's byte cap`, [dailyRepositoryReads], function* ({ readRepository }) {
		expect(yield* readRepository(kind, 8)).toBe("body over 8 bytes");
	});
}
const lists: ReadonlyArray<readonly [RepositoryList, unknown]> = [
	["issues", [{ hasNext: false, items: [issue], skipped: 0 }]],
	["commits", [{ hasNext: false, items: [commit], skipped: 0 }]],
	[
		"files",
		[
			{ hasNext: true, items: [file], skipped: 0 },
			{ hasNext: false, items: [{ additions: 2, changes: 3, deletions: 1, filename: "binary.png", sha: "file-sha", status: "added" }], skipped: 0 },
		],
	],
];
for (const [kind, expected] of lists) {
	github.it(`the typed ${kind} list returns decoded GitHub pages`, [dailyRepositoryReads], function* ({ listRepository }) {
		expect(yield* listRepository(kind)).toEqual(expected);
	});
	github.it(`the typed ${kind} list enforces its caller's page byte cap`, [dailyRepositoryReads], function* ({ listRepository }) {
		expect(yield* listRepository(kind, 8)).toBe("body over 8 bytes");
	});
}
