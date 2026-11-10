import { dirname } from "node:path";
import { isolatedGit } from "@shivaedev/test-story/server/adapters/isolatedGit.ts";

function checked(cwd: string, args: readonly string[]) {
	const result = isolatedGit(cwd, args);
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
	}
	return result.stdout;
}

export function git(root: string, ...args: readonly string[]) {
	return checked(root, args);
}

export function initRepository(root: string, ...args: readonly string[]) {
	checked(dirname(root), ["init", "-b", "main", ...args, root]);
	// Detached maintenance can outlive the release commands' own git calls and race scoped directory removal.
	git(root, "config", "maintenance.auto", "false");
	git(root, "config", "gc.auto", "0");
}
