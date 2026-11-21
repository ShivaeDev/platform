import { Config, Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { GitEnvironment, run } from "#git/command.ts";

const handed = Config.all({
	gitDir: Config.String("GIT_DIR").pipe(Config.withDefault("")),
	workTree: Config.String("GIT_WORK_TREE").pipe(Config.withDefault("")),
});

const QUERY = ["rev-parse", "--absolute-git-dir", "--show-toplevel"];

// Git prints both paths resolved, so a git dir it discovers compares equal to the one it was handed.
const located = Effect.fn("Git.located")(function* (cwd: string) {
	const result = yield* run(cwd, QUERY);
	const [gitDir, top] = result.stdout.split("\n");
	if (result.code !== 0 || gitDir === undefined || top === undefined) {
		return undefined;
	}
	return { gitDir, top };
});

// A hook in a linked worktree gets GIT_DIR without GIT_WORK_TREE, and then git takes each call's cwd as the top of the work tree,
// so a call from a source folder would miss the .gitignore files above it. When git finds the same git dir from the launch folder
// on its own, its top is the real one, even from a package folder; a separate git dir keeps git's rule, the launch folder.
export const launchEnvironment = Effect.fn("Git.launchEnvironment")(function* (cwd: string) {
	const { gitDir, workTree } = yield* handed.pipe(
		Effect.mapError((cause) => new SetupFailure({ cause, message: "cannot read GIT_DIR or GIT_WORK_TREE." })),
	);
	if (gitDir === "" || workTree !== "") {
		return {};
	}
	const named = yield* located(cwd);
	if (named === undefined) {
		return {};
	}
	const found = yield* located(cwd).pipe(Effect.provideService(GitEnvironment, { "GIT_DIR": undefined }));
	const top = found?.gitDir === named.gitDir ? found.top : named.top;
	return { "GIT_DIR": named.gitDir, "GIT_WORK_TREE": top };
});
