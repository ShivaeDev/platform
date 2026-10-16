import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { CreateAppError } from "./CreateAppError.ts";

export const initializeGit = Effect.fn("CreateApp.initializeGit")(function* (cwd: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	function exitCode(args: readonly string[]) {
		return spawner.exitCode(ChildProcess.make("git", args, { cwd }));
	}
	const available = yield* exitCode(["--version"]).pipe(
		Effect.catch((error) => (error.reason._tag === "NotFound" ? Effect.succeed(-1) : Effect.fail(error))),
	);
	if (available !== 0 || (yield* exitCode(["rev-parse", "--git-dir"])) === 0) {
		return;
	}
	const identity = yield* exitCode(["var", "GIT_AUTHOR_IDENT"]);
	const fallback = identity === 0 ? [] : ["-c", "user.name=Create App", "-c", "user.email=create-app@localhost"];
	for (const args of [
		["init", "--initial-branch=main"],
		["add", "--all"],
		[...fallback, "commit", "-m", "Initialize a generated app"],
	]) {
		const code = yield* exitCode(args);
		if (code !== 0) {
			return yield* new CreateAppError({ message: `git ${args.join(" ")} failed (exit ${code}). The generated files remain in ${cwd}.` });
		}
	}
});
