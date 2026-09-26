import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Environment, LockPaths } from "../acquire.ts";
import { type LockHolder, processStartTime } from "../holder.ts";

export const HEAVY_CLI = fileURLToPath(new URL("../../heavy.ts", import.meta.url));

const directories: string[] = [];

export const temporaryLockPaths = (): LockPaths => {
	const directory = mkdtempSync(join(tmpdir(), "heavy-process-lock-"));
	directories.push(directory);
	return { lock: join(directory, "nested", "heavy-process.lock") };
};

export const removeTemporaryDirectories = (): void => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
};

export const holder = (id: string, pid: number = process.pid, startedAtMs = 0): LockHolder => ({
	id,
	pid,
	processStartedAt: processStartTime(pid) ?? "never",
	command: `pnpm ${id}`,
	cwd: "/repo",
	startedAtMs,
});

export const deadPid = (): number => {
	const { pid } = spawnSync("/bin/sh", ["-c", ":"]);
	if (pid === undefined) {
		throw new Error("Could not spawn a short-lived process.");
	}
	return pid;
};

export const cliEnvironment = (paths: LockPaths, extra: Environment = {}): Environment => ({
	PATH: "/usr/bin:/bin",
	HEAVY_PROCESS_LOCK: paths.lock,
	...extra,
});

export interface Exit {
	readonly status: number | null;
	readonly stderr: string;
}

export interface Started {
	readonly pid: number | undefined;
	readonly stderr: () => string;
	readonly exited: Promise<Exit>;
}

const killGroup = (pid: number | undefined): void => {
	if (pid === undefined) {
		return;
	}
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		return;
	}
};

// A run that deadlocks is killed with every process it started, so the test fails instead of hanging.
export const start = (executable: string, args: readonly string[], env: Environment): Started => {
	const child = spawn(executable, args, { env, detached: true, stdio: ["ignore", "ignore", "pipe"] });
	const deadline = setTimeout(() => killGroup(child.pid), 20_000);
	let stderr = "";
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	const exited = new Promise<Exit>((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (status) => {
			clearTimeout(deadline);
			resolve({ status, stderr });
		});
	});
	return { pid: child.pid, stderr: () => stderr, exited };
};

export const runHeavyCli = (args: readonly string[], env: Environment): Promise<Exit> => start(process.execPath, [HEAVY_CLI, ...args], env).exited;

export const waitFor = async (condition: () => boolean): Promise<void> => {
	while (!condition()) {
		await sleep(10);
	}
};
