import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SetupFailure } from "#failure.ts";

export interface GitResult {
	readonly code: number;
	readonly stderr: string;
	readonly stdout: string;
}

export const run = Effect.fn("Git.run")(function* (
	cwd: string,
	args: readonly string[],
): Effect.fn.Return<GitResult, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(ChildProcess.make("git", [...args], { cwd, stdin: "ignore" }));
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			return { code: Number(code), stderr, stdout };
		}),
	).pipe(Effect.mapError((error) => new SetupFailure({ cause: error, message: `cannot run git in ${cwd}: ${error.message}` })));
});

export function gitOrFail(cwd: string, args: readonly string[]): Effect.Effect<string, SetupFailure, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.flatMap(run(cwd, args), (result) =>
		result.code === 0
			? Effect.succeed(result.stdout)
			: Effect.fail(new SetupFailure({ message: `git ${args[0]} exited ${result.code}: ${result.stderr.trim()}` })),
	);
}
