import process from "node:process";
import { Clock, Effect, Fiber, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { processes } from "@shivaedev/work-board/server/integration/processes.ts";
import type { RunningCode } from "./supervisorCode.ts";

export const logSupervisor = Effect.fn("FleetSupervisor.logSupervisor")(function* (log: string, message: string) {
	const fs = yield* FileSystem.FileSystem;
	const now = yield* Clock.currentTimeMillis;
	yield* fs.writeFileString(log, `${new Date(now).toISOString()} supervisor: ${message}\n`, { flag: "a" });
});

export const startProcess = Effect.fn("FleetSupervisor.startProcess")(function* (
	name: string,
	code: RunningCode,
	args: readonly string[],
	token: string,
	log: string,
) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const fs = yield* FileSystem.FileSystem;
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
			Stream.runForEach((text) => fs.writeFileString(log, `${name}: ${text}`, { flag: "a" })),
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
		child.kill().pipe(Effect.ignore, Effect.andThen(Effect.ignore(child.exitCode)), Effect.andThen(Fiber.join(output)), Effect.orDie),
	);
	yield* logSupervisor(log, `started ${name} pid ${child.pid} on ${code.revision}`);
	return { exit: () => exit, pid: Number(child.pid) };
});
