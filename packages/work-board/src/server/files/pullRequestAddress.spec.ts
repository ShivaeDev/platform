import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const PULLS = "https://github.com/example/project/pull/";
const TASK = { "task.md": "---\nid: task.merge\nkind: task\nstatus: ready\nnext_action: Merge #828.\n---\n# Merge the change\n" };
const SSH_ORIGIN =
	'[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:example/project.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n';
const HTTPS_ORIGIN =
	'[remote "upstream"]\n\turl = https://github.com/other/fork.git\n[remote "origin"]\n\turl = https://github.com/example/project\n';

for (const [name, files, expected] of [
	[
		"a package.json repository object",
		{ "package.json": JSON.stringify({ repository: { type: "git", url: "git+https://github.com/example/project.git" } }) },
		PULLS,
	],
	["a package.json repository shorthand", { "package.json": JSON.stringify({ name: "notes", repository: "example/project" }) }, PULLS],
	["the origin remote of a git checkout", { ".git/config": SSH_ORIGIN }, PULLS],
	[
		"the origin remote of a git worktree",
		{
			".git": "gitdir: gitdata/worktrees/notes\n",
			"gitdata/config": HTTPS_ORIGIN,
			"gitdata/worktrees/notes/commondir": "../..\n",
		},
		PULLS,
	],
	["a repository outside GitHub", { "package.json": JSON.stringify({ repository: "https://gitlab.com/example/project.git" }) }, undefined],
] as const) {
	boardStory.it(`finds the pull request address from ${name}`, [projectFiles({ ...TASK, ...files })], function* ({ readDocument }) {
		expect((yield* readDocument("task.md")).pullRequests).toBe(expected);
	});
}
