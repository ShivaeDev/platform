import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { processStartTime } from "#process-start.ts";
import { cliEnvironment, HEAVY_LOCK_CLI, holdUntilReleasedOrAbandoned, pollWhile, type Started, start, waitFor } from "./cliProcess.ts";
import { type Lock, readLock } from "./lock.ts";

export function cli(engine: Lock, tell: (line: string) => void) {
	const launch = Effect.fn("LockStory.launch")(function* (args: readonly string[], extra: Record<string, string> = {}, cwd?: string) {
		tell(`the CLI runs ${args.join(" ")}`);
		const child = yield* Effect.acquireRelease(
			Effect.sync(() => start(args, cliEnvironment(engine.lock, { ...engine.env, ...extra }), cwd)),
			(started) =>
				Effect.promise(async () => {
					started.stop();
					await started.exited;
				}),
		);
		return child;
	});
	function run(args: readonly string[], extra?: Record<string, string>) {
		return launch(args, extra).pipe(Effect.flatMap((child) => Effect.promise(() => child.exited)));
	}
	const release = join(engine.directory, "release");
	const ready = join(engine.directory, "ready");
	return {
		command: (args: readonly string[]) => run(["--", ...args]),
		exit: (child: Started) => Effect.promise(() => child.exited),
		failsProcessLookup: (fakePs: string) =>
			Effect.gen(function* () {
				const bin = join(engine.directory, "bin");
				mkdirSync(bin);
				if (fakePs !== "") {
					writeFileSync(join(bin, "ps"), fakePs);
					chmodSync(join(bin, "ps"), 0o755);
				}
				const marker = join(bin, "ran");
				const result = yield* run(["--", "/usr/bin/touch", marker], { "PATH": bin });
				return { ...result, ran: existsSync(marker) };
			}),
		nested: () => run(["--", process.execPath, "--conditions=source", HEAVY_LOCK_CLI, "--", "/bin/sh", "-c", "exit 3"]),
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
		startHolding: () =>
			Effect.gen(function* () {
				const command = holdUntilReleasedOrAbandoned(release);
				const child = yield* launch(["--", ...command], { "LANG": "de_DE.UTF-8", "LC_ALL": "de_DE.UTF-8" }, "/");
				yield* Effect.promise(() => waitFor(() => readLock(engine.lock) !== undefined));
				return { child, command: command.join(" "), processStartedAt: yield* processStartTime(child.pid) };
			}),
		startTrapping: (traps = true) =>
			Effect.gen(function* () {
				const script = traps
					? `trap "exit 10" INT; trap "exit 11" TERM; trap "exit 12" HUP; touch "${ready}"; ${pollWhile(`[ -d "${engine.directory}" ]`)}; exit 1`
					: `touch "${ready}"; exec sleep 10`;
				const child = yield* launch(["--", "/bin/sh", "-c", script]);
				yield* Effect.promise(() => waitFor(() => existsSync(ready)));
				return child;
			}),
		startWaiting: () =>
			Effect.gen(function* () {
				const child = yield* launch(["--", "true"]);
				yield* Effect.promise(() => waitFor(() => child.stderr().includes("waiting for")));
				return child;
			}),
	};
}
