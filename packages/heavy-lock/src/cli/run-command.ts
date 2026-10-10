import { Console, Effect, Option, type PlatformError, Queue } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { CommandLine } from "./args.ts";
import { type ForwardedSignal, signalExitCode } from "./signals.ts";

const COULD_NOT_START = 127;
const KILLED_BY = /signal: '(SIG[A-Z0-9]+)'/u;

// The spawner reports a child killed by a signal only as an error naming that signal.
function signalledExitCode(error: PlatformError.PlatformError) {
	const signal = KILLED_BY.exec(error.cause instanceof Error ? error.cause.message : "")?.[1];
	return signal === undefined ? Effect.fail(error) : Effect.succeed(signalExitCode(signal));
}

function spawn(commandLine: CommandLine, env: Readonly<Record<string, string>>) {
	return Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const [executable, ...args] = commandLine;
		const command = ChildProcess.make(executable, args, { env: { ...env }, extendEnv: true, stderr: "inherit", stdin: "inherit", stdout: "inherit" });
		return yield* spawner.spawn(command).pipe(
			Effect.map(Option.some),
			Effect.catch((error) => Effect.as(Console.error(`${executable}: ${error.message}`), Option.none())),
		);
	});
}

export const runCommand = (commandLine: CommandLine, env: Readonly<Record<string, string>>, signals: Queue.Dequeue<ForwardedSignal>) =>
	Effect.scoped(
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
