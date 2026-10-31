import { Effect, Sink, Stream } from "effect";
import { ChildProcessSpawner } from "effect/process";

export function scriptedProcess(result: string | Error) {
	function text(value: string) {
		return Stream.make(new TextEncoder().encode(value));
	}
	const stdout = text(result instanceof Error ? "" : result);
	const stderr = text(result instanceof Error ? result.message : "");
	return ChildProcessSpawner.makeHandle({
		all: Stream.concat(stdout, stderr),
		exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result instanceof Error ? 1 : 0)),
		getInputFd: () => Sink.drain,
		getOutputFd: () => Stream.empty,
		isRunning: Effect.succeed(false),
		kill: () => Effect.void,
		pid: ChildProcessSpawner.ProcessId(1),
		stderr,
		stdin: Sink.drain,
		stdout,
		unref: Effect.succeed(Effect.void),
	});
}
