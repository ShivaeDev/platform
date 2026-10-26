import process from "node:process";
import { Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export const launchSupervisorCli = Effect.fn("SupervisorStory.launchSupervisorCli")(function* (entry: string, args: readonly string[], cwd: string) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, ["--conditions=source", entry, ...args], {
			cwd,
			env: { "GH_TOKEN": "synthetic-supervisor-token" },
			extendEnv: true,
			stderr: "pipe",
			stdin: "ignore",
			stdout: "pipe",
		}),
	);
	let stdout = "";
	let stderr = "";
	let running = true;
	const out = yield* Effect.forkScoped(
		child.stdout.pipe(
			Stream.decodeText,
			Stream.runForEach((text) =>
				Effect.sync(() => {
					stdout += text;
				}),
			),
		),
	);
	const err = yield* Effect.forkScoped(
		child.stderr.pipe(
			Stream.decodeText,
			Stream.runForEach((text) =>
				Effect.sync(() => {
					stderr += text;
				}),
			),
		),
	);
	const result = yield* Effect.forkScoped(
		Effect.gen(function* () {
			const code = yield* child.exitCode.pipe(Effect.orElseSucceed(() => null));
			running = false;
			yield* Fiber.join(out);
			yield* Fiber.join(err);
			return { code, stderr, stdout };
		}),
	);
	yield* Effect.addFinalizer(() => child.kill().pipe(Effect.ignore, Effect.andThen(Fiber.join(result)), Effect.asVoid, Effect.orDie));
	return { done: Fiber.join(result), output: () => `${stdout}\n${stderr}`, pid: Number(child.pid), running: () => running };
});
