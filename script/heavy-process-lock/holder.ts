import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export interface LockHolder {
	readonly id: string;
	readonly pid: number;
	readonly processStartedAt: string;
	readonly command: string;
	readonly cwd: string;
	readonly startedAtMs: number;
}

export const errorCode = (error: unknown): unknown => (error instanceof Error && "code" in error ? error.code : undefined);

// `ps` prints the start time in the locale's format, so every checkout reads it in the C locale to compare it byte for byte.
export const processStartTime = (pid: number): string | undefined => {
	const { status, stdout } = spawnSync("env", ["LC_ALL=C", "ps", "-o", "lstart=", "-p", String(pid)], { encoding: "utf8" });
	const started = stdout.trim();
	return status === 0 && started !== "" ? started : undefined;
};

// A holder killed outright leaves its lock behind, and the OS may hand its pid to a new process.
export const isHolderAlive = (holder: LockHolder): boolean => processStartTime(holder.pid) === holder.processStartedAt;

const isHolder = (value: unknown): value is LockHolder =>
	typeof value === "object" &&
	value !== null &&
	"id" in value &&
	typeof value.id === "string" &&
	"pid" in value &&
	typeof value.pid === "number" &&
	"processStartedAt" in value &&
	typeof value.processStartedAt === "string" &&
	"command" in value &&
	typeof value.command === "string" &&
	"cwd" in value &&
	typeof value.cwd === "string" &&
	"startedAtMs" in value &&
	typeof value.startedAtMs === "number";

export const readHolder = (lockPath: string): LockHolder | undefined => {
	try {
		const holder: unknown = JSON.parse(readFileSync(lockPath, "utf8"));
		return isHolder(holder) ? holder : undefined;
	} catch {
		return undefined;
	}
};

export const elapsed = (fromMs: number, toMs: number): string => {
	const seconds = Math.max(0, Math.round((toMs - fromMs) / 1000));
	const minutes = Math.floor(seconds / 60);
	return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
};

export const describeHolder = (holder: LockHolder, nowMs: number): string => {
	const since = new Date(holder.startedAtMs).toLocaleTimeString("en-GB");
	return `pid ${holder.pid} running \`${holder.command}\` in ${holder.cwd} since ${since} (${elapsed(holder.startedAtMs, nowMs)})`;
};
