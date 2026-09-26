import assert from "node:assert/strict";
import process from "node:process";
import { afterEach, test } from "node:test";
import { acquire, HOLDER_ID_ENV, needsLock } from "../acquire.ts";
import { processStartTime, readHolder } from "../holder.ts";
import { release, tryAcquire } from "../lock-file.ts";
import { holder, removeTemporaryDirectories, temporaryLockPaths } from "./support.ts";

afterEach(removeTemporaryDirectories);

const ready = { id: "ready", pid: process.pid, processStartedAt: processStartTime(process.pid) ?? "never", command: "pnpm ready", cwd: "/repo" };

test("a waiter names the holder, reminds every interval, and takes the lock once it is released", async () => {
	const paths = temporaryLockPaths();
	const startedAtMs = Date.UTC(2026, 8, 26, 12, 0, 0);
	const e2e = holder("e2e", process.pid, startedAtMs);
	tryAcquire(paths.lock, e2e);
	let clockMs = startedAtMs + 30_000;
	const lines: string[] = [];

	const acquired = await acquire(paths, ready, {
		log: (line) => {
			lines.push(line);
			clockMs += 60_000;
			if (lines.length === 2) {
				release(paths.lock, e2e.id);
			}
		},
		now: () => clockMs,
		pollMs: 1,
	});

	assert.deepEqual(readHolder(paths.lock), acquired);
	assert.equal(acquired.startedAtMs, startedAtMs + 150_000);
	assert.equal(lines.length, 3);
	assert.match(lines[0] ?? "", /^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(30s\)$/);
	assert.match(lines[1] ?? "", /^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(1m 30s\)$/);
	assert.equal(lines[2], "heavy-process lock: acquired after 2m 0s");
});

test("CI and the holder's own descendants skip the lock; anyone else takes it", () => {
	const { lock } = temporaryLockPaths();
	const holding = holder("ready");
	tryAcquire(lock, holding);

	assert.equal(needsLock(lock, { CI: "true" }), false);
	assert.equal(needsLock(lock, { [HOLDER_ID_ENV]: holding.id }), false);
	assert.equal(needsLock(lock, {}), true);
	assert.equal(needsLock(lock, { CI: "" }), true);
	assert.equal(needsLock(lock, { [HOLDER_ID_ENV]: "a-finished-holder" }), true);
});
