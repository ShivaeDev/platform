import { realpathSync } from "node:fs";
import { unlink } from "node:fs/promises";
import process from "node:process";
import { Clock, Console, Effect, Exit, Scope, Semaphore } from "effect";
import { processes } from "@shivaedev/work-board/server/integration/processes.ts";
import { logSupervisor, startProcess } from "./supervisedProcess.ts";
import { codeReader, type RunningCode } from "./supervisorCode.ts";
import { processArguments, type UpOptions } from "./supervisorOptions.ts";
import { supervisorPort } from "./supervisorPort.ts";
import { logFile, type ProcessState, type SupervisorState, saveState, stateFile } from "./supervisorState.ts";

type Name = "daemon" | "board";
interface Child {
	readonly code: RunningCode;
	readonly process: Effect.Success<ReturnType<typeof startProcess>>;
	readonly scope: Scope.Closeable;
	readonly state: ProcessState;
}

export const supervise = Effect.fn("FleetSupervisor.supervise")(function* (input: UpOptions) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const root = realpathSync(input.boardDir);
			const options = {
				...input,
				boardDir: root,
				boardPort: yield* supervisorPort(input.boardPort),
				daemonPort: yield* supervisorPort(input.daemonPort),
			};
			const owner = yield* processes.currentInstance("up", { boardPort: options.boardPort, daemonPort: options.daemonPort });
			yield* processes.claimSupervisor(root, owner);
			const log = logFile(root);
			const publishing = yield* Semaphore.make(1);
			const readCode = codeReader(root);
			const codes = yield* Effect.try({ catch: (cause) => new Error(`Cannot read installed Fleet code: ${cause}`), try: readCode });
			function empty(name: Name): ProcessState {
				return {
					pid: null,
					port: name === "board" ? options.boardPort : options.daemonPort,
					restarts: 0,
					revision: codes[name].revision,
					startedAt: owner.startedAt,
				};
			}
			const state: SupervisorState = { board: empty("board"), daemon: empty("daemon"), log, pid: owner.pid, startedAt: owner.startedAt };
			const children = new Map<Name, Child>();
			yield* saveState(root, state);
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					yield* Effect.promise(() => unlink(stateFile(root)));
					yield* logSupervisor(log, "stopped Fleet and Board; releasing board").pipe(Effect.orDie);
				}),
			);
			const parent = yield* Scope.fork(yield* Scope.Scope, "parallel");
			function publish() {
				return publishing.withPermit(
					Effect.suspend(() => saveState(root, { ...state, ...Object.fromEntries([...children].map(([name, child]) => [name, child.state])) })),
				);
			}
			const start = Effect.fnUntraced(function* (name: Name, code: RunningCode, restarts: number) {
				const scope = yield* Scope.fork(parent, "sequential");
				const child = yield* startProcess(name, code, processArguments(name, options), owner.token, log).pipe(Scope.provide(scope));
				children.set(name, {
					code,
					process: child,
					scope,
					state: {
						...empty(name),
						pid: child.pid,
						restarts,
						revision: code.revision,
						startedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
					},
				});
				yield* publish();
			});
			const refresh = Effect.fnUntraced(function* (name: Name, next: ReturnType<typeof readCode>) {
				const child = children.get(name);
				if (child !== undefined) {
					const exit = child.process.exit();
					if (exit === undefined && next[name].revision === child.code.revision) {
						return;
					}
					yield* logSupervisor(
						log,
						`${name} ${exit === undefined ? `code changed to ${next[name].revision}; draining requests` : `exited unexpectedly: ${exit}`}; restarting`,
					);
					yield* Scope.close(child.scope, Exit.void);
					children.set(name, { ...child, state: { ...child.state, pid: null } });
					yield* publish();
					yield* Effect.sleep("300 millis");
					yield* start(name, next[name], child.state.restarts + 1);
				}
			});
			for (const name of ["daemon", "board"] as const) {
				yield* start(name, codes[name], 0);
			}
			yield* Console.log(`Fleet up pid ${process.pid}; Fleet port ${options.daemonPort}, Board port ${options.boardPort}\nLogs: ${log}`);
			const watch = Effect.fnUntraced(function* (name: Name) {
				for (;;) {
					yield* Effect.sleep("1 second");
					const next = yield* Effect.try({ catch: (cause) => new Error(`Cannot inspect installed Fleet code: ${cause}`), try: readCode }).pipe(
						Effect.catch((error) => logSupervisor(log, error.message).pipe(Effect.as(undefined))),
					);
					if (next !== undefined) {
						yield* refresh(name, next);
					}
				}
			});
			yield* Effect.forEach(["daemon", "board"] as const, watch, { concurrency: "unbounded", discard: true });
		}),
	);
});

export const stopSupervision = Effect.fn("FleetSupervisor.stopSupervision")(function* (root: string) {
	const owner = yield* processes.read(root, "up");
	if (owner?.kind !== "up") {
		return yield* Console.log("Fleet up is not running for this board");
	}
	process.kill(owner.pid, "SIGTERM");
	while ((yield* processes.read(root, "up"))?.token === owner.token) {
		yield* Effect.sleep("100 millis");
	}
	yield* Console.log(`Stopped Fleet and Board supervised by pid ${owner.pid}`);
});
