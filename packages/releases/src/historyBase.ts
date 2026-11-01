import { Effect, FileSystem } from "effect";
import { ChangesetError, GitError } from "#error.ts";
import { git } from "#git.ts";
import { runCommand } from "#runCommand.ts";

export const historyBase = Effect.fn("Changesets.historyBase")(function* (root: string, reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	const mergeHead = (yield* git(root, ["rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD"])).trim();
	const heads = ["HEAD", ...((yield* fs.exists(mergeHead)) ? (yield* fs.readFileString(mergeHead)).trim().split("\n") : [])];
	let cause: unknown;
	let target = reference ?? "origin/main or main";
	for (const candidate of reference === undefined ? ["origin/main", "main"] : [reference]) {
		const resolved = yield* runCommand(root, "git", ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]);
		if (resolved.exitCode === 1) {
			cause = resolved;
			continue;
		}
		if (resolved.exitCode !== 0) {
			return yield* new GitError({ cause: resolved, message: resolved.stderr.trim() });
		}
		const result = yield* runCommand(root, "git", ["merge-base", resolved.stdout.trim(), ...heads]);
		if (result.exitCode === 0) {
			return result.stdout.trim();
		}
		if (result.exitCode !== 1) {
			return yield* new GitError({ cause: result, message: result.stderr.trim() });
		}
		cause = result;
		target = candidate;
		break;
	}
	return yield* new ChangesetError({
		cause,
		message: `Cannot resolve changeset base ${target}; run git fetch origin main or pass an existing base-ref with full history.`,
	});
});
