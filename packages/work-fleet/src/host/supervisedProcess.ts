import process from "node:process";
import { Clock, Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { processes } from "@shivaedev/work-board/server/integration/processes.ts";
import { appendSupervisorLog } from "./appendSupervisorLog.ts";
import type { RunningCode } from "./supervisorCode.ts";

export const logSupervisor = Effect.fn("FleetSupervisor.logSupervisor")(function* (log: string, message: string) {
	const now = yield* Clock.currentTimeMillis;
	yield* appendSupervisorLog(log, `${new Date(now).toISOString()} supervisor: ${message}\n`);
});

export const startProcess = Effect.fn("FleetSupervisor.startProcess")(function* (
	name: string,
	code: RunningCode,
	args: readonly string[],
	token: string,
	log: string,
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const child = yield* spawner.spawn(
		ChildProcess.make(process.execPath, [...process.execArgv, code.entry, ...args], {
			env: { [processes.supervisorEnvironment]: token },
			extendEnv: true,
			stderr: "pipe",
			stdin: "ignore",
			stdout: "pipe",
		}),
	);
	const output = yield* Effect.forkScoped(
		child.all.pipe(
			Stream.decodeText,
			Stream.runForEach((text) => appendSupervisorLog(log, `${name}: ${text}`)),
		),
	);
	let exit: string | undefined;
	yield* Effect.forkScoped(
		child.exitCode.pipe(
			Effect.match({
				onFailure: (error) => {
					exit = error.cause instanceof Error ? error.cause.message : error.message;
				},
				onSuccess: (status) => {
					exit = `exit ${status}`;
				},
			}),
		),
	);
	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			yield* child.kill().pipe(
				Effect.interruptible,
				Effect.ignore,
				Effect.timeoutOrElse({
					duration: "30 seconds",
					orElse: () =>
						logSupervisor(log, `${name} pid ${child.pid} did not stop within 30 seconds; force-killing`).pipe(
							Effect.andThen(child.kill({ killSignal: "SIGKILL" })),
						),
				}),
			);
			yield* Fiber.join(output);
		}).pipe(Effect.orDie),
	);
	yield* logSupervisor(log, `started ${name} pid ${child.pid} on ${code.revision}`);
	return { exit: () => exit, pid: Number(child.pid) };
});
