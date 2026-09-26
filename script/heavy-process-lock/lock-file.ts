import { randomUUID } from "node:crypto";
import { linkSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { errorCode, isHolderAlive, type LockHolder, readHolder } from "./holder.ts";

// A racing waiter may have replaced the dead lock with a live one before the rename; that lock goes back.
const reclaim = (lockPath: string, dead: LockHolder | undefined): void => {
	const aside = `${lockPath}.${randomUUID()}.stale`;
	try {
		renameSync(lockPath, aside);
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return;
		}
		throw error;
	}
	const moved = readHolder(aside);
	if (moved !== undefined && moved.id !== dead?.id && isHolderAlive(moved)) {
		try {
			linkSync(aside, lockPath);
		} catch (error) {
			if (errorCode(error) !== "EEXIST") {
				throw error;
			}
		}
	}
	rmSync(aside, { force: true });
};

const linked = (draft: string, lockPath: string): boolean => {
	try {
		linkSync(draft, lockPath);
		return true;
	} catch (error) {
		if (errorCode(error) === "EEXIST") {
			return false;
		}
		throw error;
	}
};

// Hard-linking a complete draft publishes the holder atomically, so the lock file is never read half-written.
export const tryAcquire = (lockPath: string, holder: LockHolder): LockHolder | undefined => {
	mkdirSync(dirname(lockPath), { recursive: true });
	const draft = `${lockPath}.${holder.id}.draft`;
	writeFileSync(draft, JSON.stringify(holder));
	try {
		while (!linked(draft, lockPath)) {
			const current = readHolder(lockPath);
			if (current !== undefined && isHolderAlive(current)) {
				return current;
			}
			reclaim(lockPath, current);
		}
		return undefined;
	} finally {
		rmSync(draft, { force: true });
	}
};

export const release = (lockPath: string, id: string): void => {
	if (readHolder(lockPath)?.id === id) {
		rmSync(lockPath, { force: true });
	}
};
