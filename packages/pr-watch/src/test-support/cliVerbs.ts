import { type ChildProcess, type ExecFileException, execFile, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Deferred, Effect, Exit } from "effect";
import { type Engine, programArguments } from "./engine.ts";
import { described } from "./readouts.ts";
import { REPOSITORY } from "./server.ts";

const CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

function exitOf(error: ExecFileException | null) {
	if (error === null) {
		return 0;
	}
	return typeof error.code === "number" ? error.code : null;
}

function lines(stdout: string) {
	return stdout.split("\n").slice(0, -1).map(described);
}

function spawnWatch(engine: Engine, notify: () => void) {
	const child = spawn(process.execPath, ["--conditions=source", CLI, ...programArguments(engine)], {
		env: engine.cliEnvironment,
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout.on("data", (chunk) => {
		engine.cli.stdout += chunk.toString();
		notify();
	});
	child.stderr.on("data", (chunk) => {
		engine.cli.stderr += chunk.toString();
	});
	child.once("close", (code) => {
		engine.cli.exit = code;
		notify();
	});
	return child;
}

function killed(child: ChildProcess) {
	return Effect.callback<void>((resume) => {
		if (child.exitCode !== null || child.signalCode !== null) {
			resume(Effect.void);
			return;
		}
		child.once("close", () => resume(Effect.void));
		child.kill("SIGKILL");
	});
}

export function cliVerbs(engine: Engine, tell: (line: string) => void) {
	let changed = Deferred.makeUnsafe<void>();
	function notify() {
		Deferred.doneUnsafe(changed, Exit.void);
		changed = Deferred.makeUnsafe<void>();
	}
	let running: ChildProcess | undefined;
	return {
		cliExit: () => Effect.sync(() => (engine.cli.exit === undefined ? "still running" : `exit code ${engine.cli.exit}`)),
		cliPrinted: () => Effect.sync(() => lines(engine.cli.stdout)),
		cliPrints: (line: string) =>
			Effect.gen(function* () {
				tell(`the piped CLI prints ${line}`);
				while (!lines(engine.cli.stdout).includes(line)) {
					if (engine.cli.exit !== undefined) {
						return yield* Effect.die(new Error(`The CLI exited with ${engine.cli.exit} before printing ${line}`));
					}
					yield* Deferred.await(changed);
				}
			}),
		cliStderr: () => Effect.sync(() => engine.cli.stderr),
		cliStdout: () => Effect.sync(() => engine.cli.stdout),
		credentialsSent: () =>
			Effect.sync(() => [
				...new Set(engine.github.requests.filter(({ path }) => path.startsWith(REPOSITORY)).map(({ authorization }) => authorization ?? "none")),
			]),
		runCli: (...extra: string[]) =>
			Effect.callback<void>((resume) => {
				tell(`the CLI runs${extra.length === 0 ? "" : ` with ${extra.join(" ")}`}`);
				execFile(
					process.execPath,
					["--conditions=source", CLI, ...programArguments(engine, ...extra)],
					{ env: engine.cliEnvironment, timeout: 10_000 },
					(error, stdout, stderr) => {
						engine.cli = { exit: exitOf(error), stderr, stdout };
						resume(Effect.void);
					},
				);
			}),
		startCli: () =>
			Effect.gen(function* () {
				tell("the CLI starts a continuous watch with stdout connected to a pipe");
				running = yield* Effect.acquireRelease(
					Effect.sync(() => spawnWatch(engine, notify)),
					killed,
				);
			}),
		terminateCli: () =>
			Effect.gen(function* () {
				tell("the CLI receives SIGTERM");
				if (running === undefined) {
					return yield* Effect.die(new Error("Start the CLI before terminating it"));
				}
				running.kill("SIGTERM");
				while (engine.cli.exit === undefined) {
					yield* Deferred.await(changed);
				}
			}),
	};
}
