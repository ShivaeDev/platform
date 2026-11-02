import { Console, Effect, Option, Queue } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { type ForwardedSignal, signalledExitCode } from "#adapters/signals.ts";

export type CommandLine = readonly [string, ...string[]];

const COULD_NOT_START = 127;
const spawn = Effect.fn("HeavyLock.spawn")(function* (commandLine: CommandLine, env: Readonly<Record<string, string>>) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const [executable, ...args] = commandLine;
	const command = ChildProcess.make(executable, args, { env: { ...env }, extendEnv: true, stderr: "inherit", stdin: "inherit", stdout: "inherit" });
	return yield* spawner.spawn(command).pipe(
		Effect.map(Option.some),
		Effect.catch((error) => Effect.as(Console.error(`${executable}: ${error.message}`), Option.none())),
	);
});

export function runCommand(commandLine: CommandLine, env: Readonly<Record<string, string>>, signals: Queue.Dequeue<ForwardedSignal>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const child = yield* spawn(commandLine, env);
			if (Option.isNone(child)) {
				return COULD_NOT_START;
			}
			yield* Queue.take(signals).pipe(
				Effect.flatMap((signal) => Effect.forkScoped(Effect.ignore(child.value.kill({ killSignal: signal })))),
				Effect.forever,
				Effect.forkScoped,
			);
			return yield* child.value.exitCode.pipe(Effect.map(Number), Effect.catch(signalledExitCode));
		}),
	);
}
