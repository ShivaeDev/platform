import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const currentBranch = Effect.scoped(
	Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const git = yield* spawner.spawn(ChildProcess.make("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { stderr: "ignore", stdin: "ignore" }));
		const [printed, exitCode] = yield* Effect.all([Stream.mkString(Stream.decodeText(git.stdout)), git.exitCode], { concurrency: "unbounded" });
		const branch = printed.trim();
		return exitCode === 0 && branch !== "" ? branch : undefined;
	}),
).pipe(
	Effect.catchIf(
		(error) => error.reason._tag === "NotFound",
		() => Effect.succeed(undefined),
	),
);
