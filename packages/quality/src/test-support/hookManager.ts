import { chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { shellWords } from "#hooks/command.ts";
import { checkoutStory } from "#test/checkoutStory.ts";
import { builtRepository, type CheckoutEngine } from "#test/checkoutVerbs.ts";
import { git } from "#testing/adapters/git.ts";
import { writes } from "#testing/adapters/hookRepository.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

function worktreeFolder(engine: CheckoutEngine, worktree: string): string {
	const folder = engine.worktrees.get(worktree);
	if (folder === undefined) {
		throw new Error(`Declare linkedWorktree("${worktree}") before ${worktree}'s history`);
	}
	return folder;
}

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

// The guard keeps the story honest: should git ever hand the hook GIT_WORK_TREE too, the commit fails instead of passing for another reason.
function writeHook(hooks: string, command: string, folder: string): void {
	writes(
		hooks,
		"pre-commit",
		[
			"#!/bin/sh",
			'if [ -z "$GIT_DIR" ] || [ -n "$GIT_WORK_TREE" ]; then echo "git did not hand this hook GIT_DIR alone" >&2; exit 3; fi',
			...(folder === "" ? [] : [`cd ${shellWords([folder])} || exit 3`]),
			`exec node_modules/.bin/quality ${command}`,
			"",
		].join("\n"),
	);
	chmodSync(join(hooks, "pre-commit"), 0o755);
}

export function hookManagerRuns(command: string) {
	return checkoutStory.trait(
		"checkout",
		`a pre-commit hook that another hook manager wrote runs \`quality ${command}\` in the project folder, under the GIT_DIR git hands it without GIT_WORK_TREE`,
		(engine) => writeHook(dirname(builtRepository(engine).hook), command, engine.layout.folder),
	);
}

export function worktreeTopHas(worktree: string, ...files: readonly SeedFile[]) {
	return checkoutStory.trait("checkout", `the author writes ${pathsOf(files)} at the top of the worktree ${worktree}`, (engine) => {
		const top = join(builtRepository(engine).root, ".worktrees", worktree);
		for (const file of files) {
			writes(top, file.path, file.content);
		}
	});
}

export function committedIn(worktree: string, ...files: readonly SeedFile[]) {
	return checkoutStory.trait("checkout", `the worktree ${worktree} has committed ${pathsOf(files)} in the project folder`, (engine) => {
		const folder = worktreeFolder(engine, worktree);
		for (const file of files) {
			writes(folder, file.path, file.content);
		}
		git(folder, "add", "--", ...files.map((file) => file.path));
		git(folder, "commit", "--quiet", "--message", "Build output");
	});
}

export function untrackedIn(worktree: string, path: string) {
	return checkoutStory.trait("checkout", `in the worktree ${worktree} the author stages ${path}'s removal from git, keeping the file`, (engine) => {
		git(worktreeFolder(engine, worktree), "rm", "--quiet", "--cached", "--", path);
	});
}

// The separate git dir lies outside the project folder, which sits inside the checkout's own repository, as a dotfiles repository does.
export function separateGitDir(command: string, gitignore: SeedFile, tracked: SeedFile) {
	return checkoutStory.trait(
		"checkout",
		`the project folder is also the work tree of a separate git dir, which tracks every file of it and ${tracked.path} despite its ${gitignore.path}; its pre-commit hook runs \`quality ${command}\`, and the author's shell sets GIT_DIR to it`,
		(engine) => {
			const separate = join(builtRepository(engine).root, ".separate-git");
			const tree = ["--git-dir", separate, "--work-tree", engine.root];
			writes(engine.root, gitignore.path, gitignore.content);
			writes(engine.root, tracked.path, tracked.content);
			git(engine.root, "init", "--quiet", "--bare", separate);
			git(engine.root, ...tree, "config", "core.bare", "false");
			git(engine.root, ...tree, "add", "--all");
			git(engine.root, ...tree, "add", "--force", "--", tracked.path);
			git(engine.root, ...tree, "commit", "--quiet", "--message", "Base");
			writeHook(join(separate, "hooks"), command, "");
			engine.environment = { "GIT_DIR": separate };
		},
	);
}
