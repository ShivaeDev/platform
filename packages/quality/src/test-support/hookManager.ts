import { chmodSync } from "node:fs";
import { dirname } from "node:path";
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

// The guard keeps the story honest: should git ever hand the hook GIT_WORK_TREE too, the commit fails instead of passing for another reason.
export function hookManagerRuns(command: string) {
	return checkoutStory.trait(
		"checkout",
		`a pre-commit hook that another hook manager wrote runs \`quality ${command}\` from where git starts it, under the GIT_DIR git hands it without GIT_WORK_TREE`,
		(engine) => {
			const { hook } = builtRepository(engine);
			writes(
				dirname(hook),
				"pre-commit",
				[
					"#!/bin/sh",
					'if [ -z "$GIT_DIR" ] || [ -n "$GIT_WORK_TREE" ]; then echo "git did not hand this hook GIT_DIR alone" >&2; exit 3; fi',
					`exec node_modules/.bin/quality ${command}`,
					"",
				].join("\n"),
			);
			chmodSync(hook, 0o755);
		},
	);
}

export function committedIn(worktree: string, ...files: readonly SeedFile[]) {
	return checkoutStory.trait("checkout", `the worktree ${worktree} has committed ${files.map((file) => file.path).join(", ")}`, (engine) => {
		const folder = worktreeFolder(engine, worktree);
		for (const file of files) {
			writes(folder, file.path, file.content);
		}
		git(folder, "add", "--", ...files.map((file) => file.path));
		git(folder, "commit", "--quiet", "--message", "Build output");
	});
}

export function untrackedIn(worktree: string, path: string, gitignore: SeedFile) {
	return checkoutStory.trait(
		"checkout",
		`in the worktree ${worktree} the author writes ${gitignore.path} and stages ${path}'s removal from git, keeping the file`,
		(engine) => {
			const folder = worktreeFolder(engine, worktree);
			writes(folder, gitignore.path, gitignore.content);
			git(folder, "rm", "--quiet", "--cached", "--", path);
		},
	);
}
