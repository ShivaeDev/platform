import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { type FleetError, failure } from "./ports.ts";

function command(executable: "gh" | "git", args: ReadonlyArray<string>, disposition: FleetError["disposition"], cwd?: string) {
	return Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(
				ChildProcess.make(executable, [...args], {
					cwd,
					env: { "GH_HOST": "github.com", "GH_PROMPT_DISABLED": "1", "GIT_GRAFT_FILE": "/dev/null", "GIT_NO_REPLACE_OBJECTS": "1" },
					extendEnv: true,
					stdin: "ignore",
				}),
			);
			const [stdout, , code] = yield* Effect.all([Stream.mkString(Stream.decodeText(child.stdout)), Stream.runDrain(child.stderr), child.exitCode], {
				concurrency: "unbounded",
			});
			if (Number(code) !== 0) {
				return yield* Effect.fail(failure(`${executable} command failed (exit ${Number(code)})`));
			}
			return stdout;
		}),
	).pipe(
		Effect.timeout("30 seconds"),
		Effect.mapError(() =>
			failure(`${executable} command did not return a successful acknowledgement; reconcile before retrying a mutation`, disposition),
		),
	);
}
export function githubCommand(args: ReadonlyArray<string>) {
	return command("gh", args, args[1] === "create" || args[1] === "merge" ? "uncertain" : "retry");
}
export function githubGit(cwd: string, args: ReadonlyArray<string>) {
	return command("git", ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], args[0] === "push" ? "uncertain" : "retry", cwd);
}
