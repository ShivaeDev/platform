const user = { "avatar_url": "https://avatars.example/alice", "html_url": "https://github.com/alice", id: 7, login: "alice", type: "User" };
const issue = {
	body: null,
	"closed_at": null,
	"created_at": "2026-10-11T12:00:00Z",
	"html_url": "https://github.com/acme/widgets/issues/3",
	id: 30,
	labels: [{ name: "ready" }],
	number: 3,
	state: "open",
	title: "Ship widgets",
	"updated_at": "2026-10-12T12:00:00Z",
	user,
};
const file = { additions: 2, changes: 3, deletions: 1, filename: "new.ts", "previous_filename": "old.ts", sha: "file-sha", status: "renamed" };
const commit = {
	author: null,
	commit: { author: null, committer: null, message: "Ship widgets", tree: { sha: "tree-sha", url: "https://api.github.com/tree" } },
	committer: null,
	"html_url": "https://github.com/acme/widgets/commit/head",
	parents: [{ sha: "base-sha", url: "https://api.github.com/commit/base" }],
	sha: "head-sha",
};
const ROOT = "/repos/acme/widgets";
export const repositoryFixtures = new Map<string, unknown>([
	["/users/alice", user],
	["/user", user],
	[`${ROOT}/issues/3`, issue],
	[`${ROOT}/issues?per_page=100&state=all`, [issue]],
	[`${ROOT}/pulls/3/files?per_page=100`, [file]],
	[`${ROOT}/pulls/3/files?per_page=100&page=2`, [{ ...file, filename: "binary.png", "previous_filename": undefined, status: "added" }]],
	[
		`${ROOT}/compare/main...feature%2Fwidgets`,
		{ "ahead_by": 1, "behind_by": 0, commits: [commit], files: [file], status: "ahead", "total_commits": 1 },
	],
	[
		`${ROOT}/git/trees/feature%2Fwidgets?recursive=1`,
		{
			sha: "tree-sha",
			tree: [{ mode: "160000", path: "vendor/widgets", sha: "submodule-sha", type: "commit" }],
			truncated: true,
			url: "https://api.github.com/tree",
		},
	],
	[`${ROOT}/commits?per_page=100&sha=feature%2Fwidgets`, [commit]],
	[`${ROOT}/commits/feature%2Fwidgets`, { ...commit, files: [file], stats: { additions: 2, deletions: 1, total: 3 } }],
	[`${ROOT}/collaborators/alice/permission`, { permission: "write", "role_name": "maintain", user }],
]);
