import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import type { Holder } from "../../src/holder.ts";

const directories: string[] = [];

export const temporaryDirectory = (): string => {
	const directory = mkdtempSync(join(tmpdir(), "heavy-lock-"));
	directories.push(directory);
	return directory;
};

export const temporaryLock = (): string => join(temporaryDirectory(), "nested", "heavy-process.lock");

export const removeTemporaryDirectories = (): void => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
};

export const startTime = (pid: number): string => {
	const { status, stdout } = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
	return status === 0 ? stdout.trim() : "never";
};

export const holder = (id: string, pid: number = process.pid, startedAtMs = 0): Holder => ({
	id,
	pid,
	processStartedAt: startTime(pid),
	command: `pnpm ${id}`,
	cwd: "/repo",
	startedAtMs,
});

export const deadPid = (): number => spawnSync("/bin/sh", ["-c", ":"]).pid ?? 0;

export const writeLock = (lock: string, content: string): void => {
	mkdirSync(dirname(lock), { recursive: true });
	writeFileSync(lock, content);
};

export const readLock = (lock: string): string | undefined => (existsSync(lock) ? readFileSync(lock, "utf8") : undefined);

export const lockDirectory = (lock: string): ReadonlyArray<string> => readdirSync(dirname(lock));

// An explicit environment keeps a test from reading the machine's `CI` or lock variables.
export const services = (env: Record<string, string> = {}) =>
	Layer.mergeAll(NodeServices.layer, ConfigProvider.layer(ConfigProvider.fromEnv({ env })));
