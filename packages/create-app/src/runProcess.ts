import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { CreateAppError } from "#CreateAppError.ts";

export const runProcess = Effect.fn("CreateApp.runProcess")(function* (cwd: string, command: string, args: readonly string[], input?: string) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const stdin = input === undefined ? "ignore" : Stream.make(new TextEncoder().encode(input));
			const child = yield* spawner.spawn(ChildProcess.make(command, args, { cwd, stdin }));
			const [stdout, stderr, code] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			return { code: Number(code), stderr, stdout };
		}),
	);
});

export const checkedProcess = Effect.fn("CreateApp.checkedProcess")(function* (
	cwd: string,
	command: string,
	args: readonly string[],
	input?: string,
) {
	const result = yield* runProcess(cwd, command, args, input);
	if (result.code !== 0) {
		return yield* new CreateAppError({ message: `${command} ${args[0]} failed: ${result.stderr.trim()}` });
	}
	return result.stdout;
});
