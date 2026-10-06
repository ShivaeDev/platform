import { type HookCommand, shellWords } from "./command.ts";

const OWNER = "# Installed by @shivaedev/quality: `quality hooks install` writes it, `quality hooks uninstall` removes it.";

export function isHookShim(text: string): boolean {
	return text.split("\n").includes(OWNER);
}

// The hook moves to the checked-out worktree first, so each worktree commits under its own config and its own quality.
// Git sets GIT_DIR for a hook in a linked worktree, which makes git take the current folder as the worktree root unless GIT_WORK_TREE names it.
export function hookShim(directory: string, command: HookCommand): string {
	const folder = directory === "" ? "" : `/${shellWords([directory])}`;
	const exec = [shellWords(command.runner), '"$quality"', shellWords(command.args)].filter((part) => part !== "");
	return [
		"#!/bin/sh",
		OWNER,
		'top="$(git rev-parse --show-toplevel)" || exit 2',
		'if [ -n "$GIT_DIR" ] && [ -z "$GIT_WORK_TREE" ]; then export GIT_WORK_TREE="$top"; fi',
		`cd "$top"${folder} || exit 2`,
		`quality=${shellWords([command.launcher])}`,
		'if [ ! -e "$quality" ]; then',
		'\tprintf \'quality: cannot check this commit: %s/%s does not exist.\\nhelp: install the dependencies of this worktree, then commit again.\\n\' "$PWD" "$quality" >&2',
		"\texit 2",
		"fi",
		`exec ${exec.join(" ")}`,
		"",
	].join("\n");
}
