import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import type { Holder } from "#holder.ts";

const directories: string[] = [];

export function temporaryDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "heavy-lock-"));
	directories.push(directory);
	return directory;
}

export function temporaryLock(): string {
	return join(temporaryDirectory(), "nested", "heavy-process.lock");
}

export function removeTemporaryDirectories(): void {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
}

export function startTime(pid: number): string {
	const { status, stdout } = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", env: { LC_ALL: "C", PATH: "/usr/bin:/bin" } });
	return status === 0 ? stdout.trim() : "never";
}

export function holder(id: string, pid: number = process.pid, startedAtMs = 0): Holder {
	return {
		command: `pnpm ${id}`,
		cwd: "/repo",
		id,
		pid,
		processStartedAt: startTime(pid),
		startedAtMs,
	};
}

export function deadPid(): number {
	return spawnSync("/bin/sh", ["-c", ":"]).pid ?? 0;
}

export function writeLock(lock: string, content: string): void {
	mkdirSync(dirname(lock), { recursive: true });
	writeFileSync(lock, content);
}

export function readLock(lock: string): string | undefined {
	return existsSync(lock) ? readFileSync(lock, "utf8") : undefined;
}

export function lockDirectory(lock: string): readonly string[] {
	return readdirSync(dirname(lock));
}

// An explicit environment keeps a test from reading the machine's `CI` or lock variables.
export function services(env: Record<string, string> = {}) {
	return Layer.mergeAll(NodeServices.layer, ConfigProvider.layer(ConfigProvider.fromEnv({ env })));
}
