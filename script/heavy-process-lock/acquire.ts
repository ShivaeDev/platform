import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { describeHolder, elapsed, type LockHolder, readHolder } from "./holder.ts";
import { tryAcquire } from "./lock-file.ts";

export type Environment = Readonly<Record<string, string | undefined>>;

export const HOLDER_ID_ENV = "HEAVY_PROCESS_LOCK_ID";

export interface LockPaths {
	readonly lock: string;
}

export const lockPaths = (env: Environment): LockPaths => ({
	lock: env.HEAVY_PROCESS_LOCK ?? join(homedir(), ".cache", "heavy-process.lock"),
});

export const needsLock = (lockPath: string, env: Environment): boolean => {
	if (env.CI) {
		return false;
	}
	const inherited = env[HOLDER_ID_ENV];
	return !inherited || readHolder(lockPath)?.id !== inherited;
};

export interface AcquireOptions {
	readonly log: (line: string) => void;
	readonly now: () => number;
	readonly pollMs?: number;
	readonly remindEveryMs?: number;
}

export const acquire = async (
	paths: LockPaths,
	holder: Omit<LockHolder, "startedAtMs">,
	{ log, now, pollMs = 1_000, remindEveryMs = 60_000 }: AcquireOptions,
): Promise<LockHolder> => {
	const waitStartedMs = now();
	let announced: { readonly id: string; readonly atMs: number } | undefined;
	for (;;) {
		const attempt = { ...holder, startedAtMs: now() };
		const blocker = tryAcquire(paths.lock, attempt);
		if (blocker === undefined) {
			if (announced !== undefined) {
				log(`heavy-process lock: acquired after ${elapsed(waitStartedMs, attempt.startedAtMs)}`);
			}
			return attempt;
		}
		if (announced?.id !== blocker.id || attempt.startedAtMs - announced.atMs >= remindEveryMs) {
			announced = { id: blocker.id, atMs: attempt.startedAtMs };
			log(`heavy-process lock: waiting for ${describeHolder(blocker, attempt.startedAtMs)}`);
		}
		await sleep(pollMs);
	}
};
