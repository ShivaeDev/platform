import { join } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { git } from "#git/command.ts";

export interface HookLocation {
	readonly file: string;
	readonly hooksPath: string | undefined;
	readonly toplevel: string;
}

// Hooks live in the common git directory, which every worktree of the repository shares.
export const hookLocation = Effect.fn("Hooks.hookLocation")(function* (cwd: string) {
	const paths = yield* git(cwd, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"]);
	const [toplevel, common] = paths.stdout.trim().split("\n");
	if (paths.code !== 0 || toplevel === undefined || common === undefined) {
		return yield* new SetupFailure({
			message: `${cwd} is not in a git work tree, so there is no hook to manage.\nhelp: run quality from inside the repository, or run \`git init\` first.`,
		});
	}
	const hooksPath = yield* git(cwd, ["config", "--type=path", "--get", "core.hooksPath"]);
	const location: HookLocation = {
		file: join(common, "hooks", "pre-commit"),
		hooksPath: hooksPath.code === 0 ? hooksPath.stdout.trim() : undefined,
		toplevel,
	};
	return location;
});
