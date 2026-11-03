import { Deferred, type Duration, Effect, Exit, Fiber, type PlatformError, Scope, Stream } from "effect";
import { ChildProcess, type ChildProcessSpawner } from "effect/process";
import type { Process } from "#Process.ts";
export interface Output {
	readonly source: "stdout" | "stderr";
	readonly text: string;
}
export interface SpawnOptions<A, E, R> {
	readonly args?: readonly string[];
	readonly command: string;
	readonly cwd?: string;
	readonly env?: Readonly<Record<string, string>>;
	readonly onOutput?: (output: Output) => Effect.Effect<void>;
	readonly readiness: (stdout: Stream.Stream<string, PlatformError.PlatformError>) => Effect.Effect<A, E, R>;
	readonly stopTimeout?: Duration.Input;
}
export const spawn = Effect.fn("Supervisor.spawn")(function* <A, E, R>(
	options: SpawnOptions<A, E, R>,
): Effect.fn.Return<
	Process<A, E | PlatformError.PlatformError>,
	PlatformError.PlatformError,
	R | Scope.Scope | ChildProcessSpawner.ChildProcessSpawner
> {
	const processScope = yield* Scope.fork(yield* Effect.scope);
	const child = yield* ChildProcess.make(options.command, options.args ?? [], {
		cwd: options.cwd,
		env: options.env,
		extendEnv: true,
		forceKillAfter: options.stopTimeout ?? "5 seconds",
		killSignal: "SIGTERM",
		stderr: "pipe",
		stdin: "ignore",
		stdout: "pipe",
	}).pipe(Scope.provide(processScope));
	function record(source: Output["source"]) {
		return (text: string) => options.onOutput?.({ source, text }) ?? Effect.logInfo(text).pipe(Effect.annotateLogs({ pid: child.pid, source }));
	}
	const [logs, readiness] = yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.broadcastN({ capacity: 16, n: 2 }));
	const output = yield* Effect.forkScoped(
		Effect.all(
			[Stream.runForEach(logs, record("stdout")), child.stderr.pipe(Stream.decodeText(), Stream.splitLines, Stream.runForEach(record("stderr")))],
			{ concurrency: "unbounded", discard: true },
		),
	);
	const ready = yield* Deferred.make<A, E>();
	const readinessWorker = yield* Effect.forkScoped(
		Effect.scoped(
			Effect.gen(function* () {
				const pull = yield* Stream.toPull(readiness);
				return yield* options.readiness(Stream.fromPull(Effect.succeed(pull)));
			}),
		).pipe(Effect.onExit((exit) => Deferred.done(ready, exit))),
	);
	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			yield* Fiber.interrupt(readinessWorker);
			yield* Scope.close(processScope, Exit.void);
			yield* Fiber.join(output);
		}).pipe(Effect.orDie),
	);
	return {
		exited: child.exitCode,
		pid: Number(child.pid),
		ready: Deferred.await(ready).pipe(Effect.raceFirst(Fiber.join(output).pipe(Effect.andThen(Effect.never)))),
	};
});
