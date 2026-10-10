import { existsSync } from "node:fs";
import process from "node:process";
import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { afterEach } from "vitest";
import { readHolder, reclaim, release, tryAcquire } from "#lock-file.ts";
import { deadPid, holder, lockDirectory, removeTemporaryDirectories, services, temporaryLock, writeLock } from "#test/lock.ts";

afterEach(removeTemporaryDirectories);

const reclaimedBy = Effect.fn("HeavyLockTest.reclaimedBy")(function* (lock: string, expectedId: string) {
	expect(yield* tryAcquire(lock, holder(expectedId))).toEqual(Option.none());
	expect(Option.map(yield* readHolder(lock), ({ id }) => id)).toEqual(Option.some(expectedId));
	expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);
});

it.effect("a free lock is taken, names its holder, and only that holder releases it", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const typecheck = holder("typecheck");

		expect(yield* tryAcquire(lock, typecheck)).toEqual(Option.none());
		expect(yield* readHolder(lock)).toEqual(Option.some(typecheck));
		expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);

		yield* release(lock, "someone-else");
		expect(yield* readHolder(lock)).toEqual(Option.some(typecheck));
		yield* release(lock, typecheck.id);
		expect(existsSync(lock)).toBe(false);
	}).pipe(Effect.provide(services())),
);

it.effect("a live holder whose process start time matches blocks the lock and is never preempted", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const build = holder("build");
		yield* tryAcquire(lock, build);

		expect(yield* tryAcquire(lock, holder("test"))).toEqual(Option.some(build));
		expect(yield* readHolder(lock)).toEqual(Option.some(build));
		expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);
	}).pipe(Effect.provide(services())),
);

it.effect("a dead holder's lock is reclaimed", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		yield* tryAcquire(lock, holder("crashed", deadPid()));

		yield* reclaimedBy(lock, "test");
	}).pipe(Effect.provide(services())),
);

it.effect("a lock whose pid now belongs to a different process is reclaimed", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		yield* tryAcquire(lock, { ...holder("killed"), processStartedAt: "Thu Jan  1 00:00:00 1970" });

		yield* reclaimedBy(lock, "test");
	}).pipe(Effect.provide(services())),
);

it.effect("a lock written without the holder's process start time is reclaimed, even while its pid runs", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		writeLock(lock, JSON.stringify({ command: "pnpm ready", cwd: "/repo", id: "unversioned", pid: process.pid, startedAtMs: 0 }));

		yield* reclaimedBy(lock, "test");
	}).pipe(Effect.provide(services())),
);

it.effect("a lock that names no holder is reclaimed", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		writeLock(lock, "not a holder");

		yield* reclaimedBy(lock, "test");
	}).pipe(Effect.provide(services())),
);

it.effect("reclaiming a dead holder puts back a live holder that raced in first, and drops the dead one", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const dead = holder("crashed", deadPid());
		const raced = holder("raced");
		yield* tryAcquire(lock, raced);

		yield* reclaim(lock, Option.some(dead));
		expect(yield* readHolder(lock)).toEqual(Option.some(raced));
		expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);

		yield* reclaim(lock, Option.some(raced));
		expect(existsSync(lock)).toBe(false);
		expect(lockDirectory(lock)).toEqual([]);
	}).pipe(Effect.provide(services())),
);

it.effect("reclaiming a lock already removed by another waiter leaves no stale file", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const dead = holder("crashed", deadPid());
		yield* tryAcquire(lock, dead);
		yield* reclaim(lock, Option.some(dead));

		yield* reclaim(lock, Option.some(dead));

		expect(existsSync(lock)).toBe(false);
		expect(lockDirectory(lock)).toEqual([]);
	}).pipe(Effect.provide(services())),
);
