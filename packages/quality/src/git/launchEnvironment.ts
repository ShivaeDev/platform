import { Config, Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { run } from "#git/command.ts";

const handed = Config.all({
	gitDir: Config.String("GIT_DIR").pipe(Config.withDefault("")),
	workTree: Config.String("GIT_WORK_TREE").pipe(Config.withDefault("")),
});

// A hook in a linked worktree gets GIT_DIR without GIT_WORK_TREE, and then git takes each call's cwd as the top of the work tree,
// so a call from a source folder would miss the .gitignore files above it. Git's own rule puts the top at the folder Quality started in.
export const launchEnvironment = Effect.fn("Git.launchEnvironment")(function* (cwd: string) {
	const { gitDir, workTree } = yield* handed.pipe(
		Effect.mapError((cause) => new SetupFailure({ cause, message: "cannot read GIT_DIR or GIT_WORK_TREE." })),
	);
	if (gitDir === "" || workTree !== "") {
		return {};
	}
	const resolved = yield* run(cwd, ["rev-parse", "--absolute-git-dir", "--show-toplevel"]);
	const [absolute, top] = resolved.stdout.split("\n");
	if (resolved.code !== 0 || absolute === undefined || top === undefined) {
		return {};
	}
	return { "GIT_DIR": absolute, "GIT_WORK_TREE": top };
});
