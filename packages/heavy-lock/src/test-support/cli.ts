import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { cliEnvironment, HEAVY_LOCK_CLI, holdUntilReleasedOrAbandoned, pollWhile, type Started, start, waitFor } from "./cliProcess.ts";
import { type Lock, readLock } from "./lock.ts";
import { startTime } from "./startTime.ts";

export function cli(engine: Lock, tell: (line: string) => void) {
	const launch = Effect.fn("LockStory.launch")(function* (args: readonly string[]) {
		tell(`the CLI runs ${args.join(" ")}`);
		return yield* Effect.acquireRelease(
			Effect.sync(() => start(args, cliEnvironment(engine.lock, engine.env), engine.cliOptions.cwd)),
			(child) =>
				Effect.promise(async () => {
					child.stop();
					await child.exited;
				}),
		);
	});
	function run(args: readonly string[]) {
		return launch(args).pipe(Effect.flatMap((child) => Effect.promise(() => child.exited)));
	}
	const release = join(engine.directory, "release");
	const ready = join(engine.directory, "ready");
	const marker = join(engine.directory, "ran");
	return {
		command: (args: readonly string[]) => run(["--", ...args]),
		exit: (child: Started) => Effect.promise(() => child.exited),
		holdingCommand: holdUntilReleasedOrAbandoned(release),
		marker,
		markerExists: () => existsSync(marker),
		path: HEAVY_LOCK_CLI,
		processStart: (child: Started) => startTime(child.pid),
		raw: (args: readonly string[]) => run(args),
		release: () =>
			Effect.sync(() => {
				tell("the CLI holder is released");
				writeFileSync(release, "");
			}),
		signal: (child: Started, signal: NodeJS.Signals) =>
			Effect.sync(() => {
				tell(`the CLI receives ${signal}`);
				process.kill(child.pid, signal);
			}),
		sleepingCommand: ["/bin/sh", "-c", `touch "${ready}"; exec sleep 10`],
		start: (args: readonly string[]) => launch(["--", ...args]),
		trappingCommand: (signal: NodeJS.Signals, code: number) => [
			"/bin/sh",
			"-c",
			`trap "exit ${code}" ${signal.slice(3)}; touch "${ready}"; ${pollWhile(`[ -d "${engine.directory}" ]`)}; exit 1`,
		],
		waitForLock: () => Effect.promise(() => waitFor(() => readLock(engine.lock) !== undefined)),
		waitForReady: () => Effect.promise(() => waitFor(() => existsSync(ready))),
		waitForWaiting: (child: Started) => Effect.promise(() => waitFor(() => child.stderr().includes("waiting for"))),
	};
}
