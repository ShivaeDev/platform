import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { CreateAppError } from "./CreateAppError.ts";

function git(cwd: string, args: readonly string[], inherit = false) {
	return Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
		spawner.exitCode(ChildProcess.make("git", args, { cwd, stderr: inherit ? "inherit" : "pipe", stdout: inherit ? "inherit" : "pipe" })),
	);
}

const checkedGit = Effect.fn("CreateApp.checkedGit")(function* (cwd: string, args: readonly string[]) {
	const code = yield* git(cwd, args, true);
	if (code !== 0) {
		return yield* new CreateAppError({ message: `git ${args.join(" ")} failed (exit ${code}). The generated files remain in ${cwd}.` });
	}
});

export const initializeGit = Effect.fn("CreateApp.initializeGit")(function* (cwd: string) {
	const available = yield* git(cwd, ["--version"]).pipe(
		Effect.catch((error) => (error.reason._tag === "NotFound" ? Effect.succeed(-1) : Effect.fail(error))),
	);
	if (available !== 0 || (yield* git(cwd, ["rev-parse", "--git-dir"])) === 0) {
		return false;
	}
	yield* checkedGit(cwd, ["init", "--initial-branch=main"]);
	return true;
});

export const commitGit = Effect.fn("CreateApp.commitGit")(function* (cwd: string) {
	const identity = yield* git(cwd, ["var", "GIT_AUTHOR_IDENT"]);
	const fallback = identity === 0 ? [] : ["-c", "user.name=Create App", "-c", "user.email=create-app@localhost"];
	yield* checkedGit(cwd, ["add", "--all"]);
	yield* checkedGit(cwd, [...fallback, "commit", "-m", "Initialize a generated app"]);
});
