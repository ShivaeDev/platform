import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { GitError } from "@shivaedev/releases/error.ts";
import { runCommand } from "@shivaedev/releases/runCommand.ts";
import { checkPlatform } from "#release/check.ts";
import { git } from "#release/git.ts";

export const frozenPasses = Effect.fn("Release.frozenPasses")(function* (root: string, head: string) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = join(yield* fs.makeTempDirectoryScoped({ prefix: "frozen-release-" }), "workspace");
			yield* Effect.acquireRelease(git(root, "worktree", "add", "--detach", directory, "origin/main"), () =>
				git(root, "worktree", "remove", "--force", directory).pipe(Effect.orDie),
			);
			const merged = yield* runCommand(directory, "git", ["merge", "--no-commit", "--no-ff", head]);
			if (merged.exitCode === 1) {
				return false;
			}
			if (merged.exitCode !== 0) {
				return yield* new GitError({ cause: merged, message: merged.stderr.trim() });
			}
			return yield* checkPlatform(directory, "origin/main").pipe(
				Effect.as(true),
				Effect.catchTag("ChangesetError", () => Effect.succeed(false)),
			);
		}),
	);
});
