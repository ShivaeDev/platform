import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:os";
import process from "node:process";
import { acquire, type Environment, HOLDER_ID_ENV, lockPaths, needsLock } from "./acquire.ts";
import { processStartTime } from "./holder.ts";
import { release } from "./lock-file.ts";

export interface Runtime {
	readonly env: Environment;
	readonly log: (line: string) => void;
	readonly now: () => number;
}

const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

export const runCommand = (command: readonly string[], env: Environment, log: (line: string) => void): Promise<number> => {
	const [executable, ...args] = command;
	if (executable === undefined) {
		return Promise.reject(new Error("No command to run."));
	}
	const child = spawn(executable, args, { stdio: "inherit", env });
	// Ctrl-C already reaches the child through the terminal's process group.
	const forward = (signal: NodeJS.Signals) => {
		if (signal !== "SIGINT") {
			child.kill(signal);
		}
	};
	for (const signal of SIGNALS) {
		process.on(signal, forward);
	}
	return new Promise<number>((resolve) => {
		child.on("error", (error) => {
			log(`${executable}: ${error.message}`);
			resolve(127);
		});
		child.on("exit", (code, signal) => {
			resolve(code ?? 128 + (signal === null ? 0 : constants.signals[signal]));
		});
	}).finally(() => {
		for (const signal of SIGNALS) {
			process.off(signal, forward);
		}
	});
};

export const runHeavy = async (command: readonly string[], { env, log, now }: Runtime): Promise<number> => {
	const paths = lockPaths(env);
	if (!needsLock(paths.lock, env)) {
		return runCommand(command, env, log);
	}
	const processStartedAt = processStartTime(process.pid);
	if (processStartedAt === undefined) {
		throw new Error("Could not read this process's start time from ps.");
	}
	const holder = await acquire(
		paths,
		{ id: randomUUID(), pid: process.pid, processStartedAt, command: command.join(" "), cwd: process.cwd() },
		{ log, now },
	);
	const releaseLock = () => release(paths.lock, holder.id);
	process.on("exit", releaseLock);
	try {
		return await runCommand(command, { ...env, [HOLDER_ID_ENV]: holder.id }, log);
	} finally {
		releaseLock();
		process.off("exit", releaseLock);
	}
};
