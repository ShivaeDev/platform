import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const CLI_ARGUMENTS = [
	"--conditions=source",
	"--import",
	fileURLToPath(new URL("./cliClock.ts", import.meta.url)),
	fileURLToPath(new URL("../cli.ts", import.meta.url)),
];

export interface CliRun {
	readonly advanceTo: (time: number) => void;
	readonly exited: Promise<number | null>;
	readonly nextPoll: Promise<number>;
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

export function startCli(args: readonly string[], env: Record<string, string>, now: number, cwd?: string): CliRun {
	const child = spawn(process.execPath, [...CLI_ARGUMENTS, ...args], {
		cwd,
		detached: true,
		env: { ...env, "HEAVY_LOCK_STORY_TIME": String(now) },
		stdio: ["pipe", "pipe", "pipe", "ipc"],
	});
	const { stdin: input, stdout: output, stderr: errors } = child;
	if (input === null || output === null || errors === null) {
		throw new Error("The story CLI needs piped standard input, output and error streams.");
	}
	const stdin = input;
	let sleeping = false;
	let check: () => void = commandNoLongerReads;
	const nextPoll = new Promise<number>((resolve) => {
		child.on("message", (time: number) => {
			sleeping = true;
			resolve(time);
			check();
		});
	});
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
		stdin.end();
		if (status === undefined) {
			killGroup(child.pid);
		}
	}
	stdin.on("error", commandNoLongerReads);
	const exited = new Promise<number | null>((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (code) => {
			status = code;
			resolve(code);
		});
	});
	const settled = new Promise<void>((resolve) => {
		check = () => {
			if (state() !== "starting" && (state() !== "waiting" || sleeping)) {
				resolve();
			}
		};
		output.setEncoding("utf8").on("data", (chunk: string) => {
			stdout += chunk;
			check();
		});
		errors.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
			check();
		});
		child.on("close", check);
	});
	return {
		advanceTo: (time) => child.send(time),
		exited,
		nextPoll,
		pid: child.pid ?? 0,
		release: () => stdin.write("\n"),
		settled,
		state,
		stderr: () => stderr,
		stdout: () => stdout,
		stop,
	};
}
