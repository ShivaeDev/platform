import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { afterEach, test } from "node:test";
import { readHolder } from "../holder.ts";
import { release, tryAcquire } from "../lock-file.ts";
import { deadPid, holder, removeTemporaryDirectories, temporaryLockPaths } from "./support.ts";

afterEach(removeTemporaryDirectories);

test("a free lock is taken, names its holder, and only that holder releases it", () => {
	const { lock } = temporaryLockPaths();
	const typecheck = holder("typecheck");

	assert.equal(tryAcquire(lock, typecheck), undefined);
	assert.deepEqual(readHolder(lock), typecheck);

	release(lock, "someone-else");
	assert.deepEqual(readHolder(lock), typecheck);
	release(lock, typecheck.id);
	assert.equal(existsSync(lock), false);
});

test("a live holder whose process start time matches blocks the lock and is never preempted", () => {
	const { lock } = temporaryLockPaths();
	const build = holder("build");
	tryAcquire(lock, build);

	assert.deepEqual(tryAcquire(lock, holder("test")), build);
	assert.deepEqual(readHolder(lock), build);
});

test("a dead holder's lock is reclaimed", () => {
	const { lock } = temporaryLockPaths();
	tryAcquire(lock, holder("crashed", deadPid()));

	assert.equal(tryAcquire(lock, holder("test")), undefined);
	assert.equal(readHolder(lock)?.id, "test");
});

test("a lock whose pid now belongs to a different process is reclaimed", () => {
	const { lock } = temporaryLockPaths();
	tryAcquire(lock, { ...holder("killed"), processStartedAt: "Thu Jan  1 00:00:00 1970" });

	assert.equal(tryAcquire(lock, holder("test")), undefined);
	assert.equal(readHolder(lock)?.id, "test");
});

test("a lock written without the holder's process start time is reclaimed, even while its pid runs", () => {
	const { lock } = temporaryLockPaths();
	mkdirSync(dirname(lock), { recursive: true });
	writeFileSync(lock, JSON.stringify({ id: "unversioned", pid: process.pid, command: "pnpm ready", cwd: "/repo", startedAtMs: 0 }));

	assert.equal(tryAcquire(lock, holder("test")), undefined);
	assert.equal(readHolder(lock)?.id, "test");
});

test("a lock that names no holder is reclaimed", () => {
	const { lock } = temporaryLockPaths();
	mkdirSync(dirname(lock), { recursive: true });
	writeFileSync(lock, "not a holder");

	assert.equal(tryAcquire(lock, holder("test")), undefined);
	assert.equal(readHolder(lock)?.id, "test");
});
