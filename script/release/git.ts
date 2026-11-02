import { Effect } from "effect";
import { git as releaseGit } from "@shivaedev/releases/git.ts";

export function git(root: string, ...args: readonly string[]) {
	return releaseGit(root, args).pipe(Effect.map((stdout) => stdout.trim()));
}
