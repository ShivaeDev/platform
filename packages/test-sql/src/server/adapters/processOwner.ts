import { createHash } from "node:crypto";
import { hostname } from "node:os";
import process from "node:process";
import { Effect } from "effect";

export const processOwner = Effect.sync(() => ({
	host: createHash("sha256").update(hostname()).digest("hex").slice(0, 8),
	pid: process.pid,
}));

export function processIsAbsent(pid: number) {
	return Effect.sync(() => {
		try {
			process.kill(pid, 0);
			return false;
		} catch (error) {
			return error instanceof Error && "code" in error && error.code === "ESRCH";
		}
	});
}
