import { shellWords } from "./command.ts";

const OWNER = "# Installed by @shivaedev/quality: `quality hooks install` writes it, `quality hooks uninstall` removes it.";

export function isHookShim(text: string): boolean {
	return text.split("\n").includes(OWNER);
}

// The hook moves to the checked-out worktree first, so each worktree commits under its own config and its own quality.
export function hookShim(directory: string, command: readonly string[]): string {
	const folder = directory === "" ? "" : `/${shellWords([directory])}`;
	return ["#!/bin/sh", OWNER, `cd "$(git rev-parse --show-toplevel)"${folder} || exit 2`, `exec ${shellWords(command)}`, ""].join("\n");
}
