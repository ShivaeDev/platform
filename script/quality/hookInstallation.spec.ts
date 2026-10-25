import { afterEach, expect } from "vitest";
import { hookStory } from "#quality/test-support/hookStory.ts";
import { removeSeededTrees } from "#quality-fixtures/tree.ts";

afterEach(removeSeededTrees);

hookStory.it("installs an executable pre-commit hook that runs the checked-out worktree's quality", [], ({ git, hooks }) => {
	expect(hooks.run("install")).toEqual({
		status: 0,
		stderr: "",
		stdout: `quality: installed the pre-commit hook at ${hooks.path()}; each commit runs \`node_modules/.bin/quality hooks pre-commit\`.\nquality: set repository-local core.hooksPath to ${hooks.directory()}.\nquality: no executable global pre-commit hook to chain.\n`,
	});
	expect(hooks.permissions()).toEqual({
		group: { execute: true, read: true, write: false },
		others: { execute: true, read: true, write: false },
		owner: { execute: true, read: true, write: true },
	});
	expect(git.config("--local", "--get", "core.hooksPath").stdout.trim()).toBe(hooks.directory());
});
