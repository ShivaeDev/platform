import { Effect } from "effect";
import { GitError } from "#error.ts";
import { runCommand } from "#runCommand.ts";

export const git = Effect.fn("Changesets.git")(function* (root: string, args: readonly string[]) {
	const result = yield* runCommand(root, "git", args);
	if (result.exitCode !== 0) {
		return yield* new GitError({ cause: result, message: `git ${args.join(" ")}: ${result.stderr.trim()}` });
	}
	return result.stdout;
});
