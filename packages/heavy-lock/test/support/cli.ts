import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const HEAVY_LOCK_CLI = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));

export const cliEnvironment = (lock: string, extra: Record<string, string> = {}): Record<string, string> => ({
	PATH: "/usr/bin:/bin",
	HEAVY_PROCESS_LOCK: lock,
	...extra,
});

export interface Exit {
	readonly status: number | null;
	readonly stderr: string;
}

export interface Started {
	readonly pid: number;
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
export const start = (args: ReadonlyArray<string>, env: Record<string, string>, cwd?: string): Started => {
	const child = spawn(process.execPath, [HEAVY_LOCK_CLI, ...args], { cwd, env, detached: true, stdio: ["ignore", "ignore", "pipe"] });
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
	return { pid: child.pid ?? 0, stderr: () => stderr, exited };
};

export const runCli = (args: ReadonlyArray<string>, env: Record<string, string>, cwd?: string): Promise<Exit> => start(args, env, cwd).exited;

export const waitFor = async (condition: () => boolean): Promise<void> => {
	while (!condition()) {
		await sleep(10);
	}
};
