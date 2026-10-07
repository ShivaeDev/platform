import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const HEAVY_LOCK_CLI = fileURLToPath(new URL("../cli.ts", import.meta.url));

export function cliEnvironment(lock: string, extra: Record<string, string> = {}): Record<string, string> {
	return {
		"HEAVY_PROCESS_LOCK": lock,
		"PATH": "/usr/bin:/bin",
		...extra,
	};
}

export interface Exit {
	readonly status: number | null;
	readonly stderr: string;
}

export const TEST_TIMEOUT_MS = 20_000;

function killGroup(pid: number | undefined): void {
	if (pid === undefined) {
		return;
	}
	try {
		process.kill(-pid, "SIGKILL");
	} catch {}
}

export interface Started {
	readonly exited: Promise<Exit>;
	readonly pid: number;
	readonly stderr: () => string;
	readonly stop: () => void;
}

// A run that deadlocks is killed so the test fails instead of hanging; its command, in a process group of its own, ends through its own bound.
export function start(args: readonly string[], env: Record<string, string>, cwd?: string): Started {
	const child = spawn(process.execPath, ["--conditions=source", HEAVY_LOCK_CLI, ...args], {
		cwd,
		detached: true,
		env,
		stdio: ["ignore", "ignore", "pipe"],
	});
	let running = true;
	function stop() {
		if (running) {
			killGroup(child.pid);
		}
	}
	const deadline = setTimeout(stop, TEST_TIMEOUT_MS);
	let stderr = "";
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
		stderr += chunk;
	});
	const exited = new Promise<Exit>((resolve, reject) => {
		child.on("error", reject);
		child.on("close", (status) => {
			running = false;
			clearTimeout(deadline);
			resolve({ status, stderr });
		});
	});
	return { exited, pid: child.pid ?? 0, stderr: () => stderr, stop };
}

export function runCli(args: readonly string[], env: Record<string, string>, cwd?: string): Promise<Exit> {
	return start(args, env, cwd).exited;
}

// The command runs outside the test's process group, so a test run that dies without cleaning up cannot stop it; the loop gives up on its own after about the test timeout.
export function pollWhile(condition: string): string {
	return `give_up=$(($(date +%s) + ${TEST_TIMEOUT_MS / 1000})); while ${condition} && [ "$(date +%s)" -lt "$give_up" ]; do sleep 0.02; done`;
}

export function holdUntilReleasedOrAbandoned(release: string): readonly string[] {
	return ["/bin/sh", "-c", `${pollWhile(`[ ! -e "${release}" ] && [ -d "${dirname(release)}" ]`)}; test -e "${release}"`];
}

const WAIT_LEAVING_TIME_FOR_CLEANUP_MS = TEST_TIMEOUT_MS / 2;

export async function waitFor(condition: () => boolean): Promise<void> {
	const deadline = performance.now() + WAIT_LEAVING_TIME_FOR_CLEANUP_MS;
	while (!condition()) {
		if (performance.now() > deadline) {
			throw new Error(`Condition not met within ${WAIT_LEAVING_TIME_FOR_CLEANUP_MS} ms.`);
		}
		await sleep(10);
	}
}
