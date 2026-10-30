import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const runCommand = Effect.fn("Changesets.runCommand")(function* (root: string, executable: string, args: readonly string[]) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const child = yield* spawner.spawn(ChildProcess.make(executable, args, { cwd: root, stdin: "ignore" }));
			const [stdout, stderr, exitCode] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			return { exitCode, stderr, stdout };
		}),
	);
});
