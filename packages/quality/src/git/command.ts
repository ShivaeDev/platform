import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SetupFailure } from "../failure.ts";

export interface GitResult {
	readonly code: number;
	readonly stdout: string;
	readonly stderr: string;
}

export type Git = ChildProcessSpawner.ChildProcessSpawner;

export const git = (cwd: string, args: ReadonlyArray<string>): Effect.Effect<GitResult, SetupFailure, Git> =>
	Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(ChildProcess.make("git", [...args], { cwd, stdin: "ignore" }));
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			return { code: Number(code), stderr, stdout };
		}),
	).pipe(Effect.mapError((error) => new SetupFailure({ message: `cannot run git: ${error.message}` })));

export const gitOrFail = (cwd: string, args: ReadonlyArray<string>): Effect.Effect<string, SetupFailure, Git> =>
	Effect.flatMap(git(cwd, args), (result) =>
		result.code === 0
			? Effect.succeed(result.stdout)
			: Effect.fail(new SetupFailure({ message: `git ${args[0]} failed: ${result.stderr.trim() || `exit code ${result.code}`}` })),
	);
