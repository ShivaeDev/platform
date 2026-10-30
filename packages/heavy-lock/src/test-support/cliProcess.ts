import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const HEAVY_LOCK_CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export const TEST_TIMEOUT_MS = 20_000;

const COMMAND_LIFETIME_S = TEST_TIMEOUT_MS / 1000;

export function cliEnvironment(lock: string, extra: Record<string, string> = {}): Record<string, string> {
	return {
		"HEAVY_PROCESS_LOCK": lock,
		"PATH": "/usr/bin:/bin",
		...extra,
	};
}

export type CommandLine = readonly [string, ...string[]];

function shell(script: string): CommandLine {
	return ["/bin/sh", "-c", `echo running; ${script}`];
}

// Each command reports "running" on stdout once the CLI has started it; a command that waits ends by itself after the test timeout, because it runs in its own process group where the cleanup of an abandoned test cannot reach it.
export const commands = {
	exitsWith: (code: number) => shell(`exit ${code}`),
	holdsUntilReleased: shell("read line"),
	killsItselfWith: (signal: NodeJS.Signals) => shell(`kill -${signal.slice(3)} $$`),
	nestedRunOf: (command: CommandLine): CommandLine => [process.execPath, "--conditions=source", HEAVY_LOCK_CLI, "--", ...command],
	printsToStderr: (line: string) => shell(`echo '${line}' >&2`),
	reportsArguments: (...args: readonly string[]): CommandLine => [...shell('printf "%s\\n" "$@"'), "check", ...args],
	reportsHolderId: shell('printf "holder id=%s\\nlock=%s\\n" "$HEAVY_PROCESS_LOCK_ID" "$(cat "$HEAVY_PROCESS_LOCK" 2>/dev/null)"'),
	reportsProcessGroup: shell('if [ "$(ps -o pgid= -p $$ | tr -d " ")" = "$$" ]; then echo "leads its process group"; fi'),
	sleeps: shell(`exec sleep ${COMMAND_LIFETIME_S}`),
	trapsAndExits: (signal: NodeJS.Signals, code: number): CommandLine => [
		"/bin/sh",
		"-c",
		`trap 'kill $sleeper 2>/dev/null; exit ${code}' ${signal.slice(3)}; sleep ${COMMAND_LIFETIME_S} & sleeper=$!; echo running; wait $sleeper; exit 1`,
	],
};

export interface CliRun {
	readonly exited: Promise<number | null>;
	readonly pid: number;
	readonly release: () => void;
	readonly settled: Promise<void>;
	readonly state: () => string;
	readonly stderr: () => string;
	readonly stdout: () => string;
	readonly stop: () => void;
}

function killGroup(pid: number | undefined): void {
	if (pid === undefined) {
		return;
	}
	try {
		process.kill(-pid, "SIGKILL");
	} catch (error) {
		// The process group may have exited before cleanup reaches it.
		if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
			throw error;
		}
	}
}

function commandNoLongerReads(): undefined {
	return undefined;
}

export function startCli(args: readonly string[], env: Record<string, string>, cwd?: string): CliRun {
	const child = spawn(process.execPath, ["--conditions=source", HEAVY_LOCK_CLI, ...args], { cwd, detached: true, env, stdio: "pipe" });
	let status: number | null | undefined;
	let stdout = "";
	let stderr = "";
	function state() {
		if (status !== undefined) {
			return `exited with ${status}`;
		}
		if (stdout.startsWith("running\n")) {
			return "running";
		}
		return stderr.includes("heavy-process lock: waiting for") ? "waiting" : "starting";
	}
	function stop() {
		child.stdin.end();
		if (status === undefined) {
			killGroup(child.pid);
		}
	}
	const deadline = setTimeout(stop, TEST_TIMEOUT_MS);
	child.stdin.on("error", commandNoLongerReads);
	const exited = new Promise<number | null>((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (code) => {
			status = code;
			clearTimeout(deadline);
			resolve(code);
		});
	});
	const settled = new Promise<void>((resolve) => {
		function check() {
			if (state() !== "starting") {
				resolve();
			}
		}
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			stdout += chunk;
			check();
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
			check();
		});
		child.on("close", check);
	});
	return {
		exited,
		pid: child.pid ?? 0,
		release: () => child.stdin.write("\n"),
		settled,
		state,
		stderr: () => stderr,
		stdout: () => stdout,
		stop,
	};
}
