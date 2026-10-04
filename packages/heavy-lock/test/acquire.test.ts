import { rmSync } from "node:fs";
import process from "node:process";
import { expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Option } from "effect";
import { TestConsole } from "effect/testing";
import { afterEach } from "vitest";
import { HeldLock } from "#held-lock.ts";
import { encodeHolder, HOLDER_ID_ENV } from "#holder.ts";
import { readHolder, tryAcquire } from "#lock-file.ts";
import { scriptedClock } from "#test/support/clock.ts";
import { holder, lockDirectory, readLock, removeTemporaryDirectories, services, temporaryLock } from "#test/support/lock.ts";
import { heavyLockLayer, withHeavyLock } from "#with-heavy-lock.ts";

afterEach(removeTemporaryDirectories);

const holding = (lock: string) =>
	Effect.gen(function* () {
		const held = yield* HeldLock;
		return { env: held.env, holder: yield* readHolder(lock) };
	});

it.effect("a waiter names the holder, reminds every minute, and takes the lock once it is released", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const startedAtMs = Date.UTC(2026, 8, 26, 12, 0, 0);
		yield* tryAcquire(lock, holder("e2e", process.pid, startedAtMs));
		const scripted = yield* scriptedClock(startedAtMs + 30_000, (_line, lines) => {
			if (lines.length === 2) {
				rmSync(lock);
			}
			return 60_000;
		});

		const held = yield* scripted.provide(withHeavyLock(holding(lock), { command: "pnpm ready", lockPath: lock, pollInterval: "1 millis" }));

		expect(Option.map(held.holder, ({ command, startedAtMs }) => ({ command, startedAtMs }))).toEqual(
			Option.some({ command: "pnpm ready", startedAtMs: startedAtMs + 150_000 }),
		);
		expect(held.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(held.holder).id });
		expect(scripted.lines).toHaveLength(3);
		expect(scripted.lines[0]).toMatch(/^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(30s\)$/u);
		expect(scripted.lines[1]).toMatch(/^heavy-process lock: waiting for pid \d+ running `pnpm e2e` in \/repo since \d\d:\d\d:\d\d \(1m 30s\)$/u);
		expect(scripted.lines[2]).toBe("heavy-process lock: acquired after 2m 0s");
		expect(readLock(lock)).toBeUndefined();
	}).pipe(Effect.provide(services())),
);

it.effect("CI skips the lock, even while another run holds it; an empty CI does not", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const typecheck = holder("typecheck");
		yield* tryAcquire(lock, typecheck);

		const skipped = yield* withHeavyLock(holding(lock), { lockPath: lock }).pipe(Effect.provide(services({ CI: "true" })));
		expect(skipped).toEqual({ env: {}, holder: Option.some(typecheck) });

		rmSync(lock);
		const taken = yield* withHeavyLock(holding(lock), { lockPath: lock }).pipe(Effect.provide(services({ CI: "" })));
		expect(taken.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(taken.holder).id });
	}).pipe(Effect.provide(services())),
);

it.effect("the holder's own descendants run under its lock; a finished holder's id takes a new lock", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const ready = holder("ready");
		yield* tryAcquire(lock, ready);

		const nested = yield* withHeavyLock(holding(lock), { lockPath: lock }).pipe(Effect.provide(services({ [HOLDER_ID_ENV]: ready.id })));
		expect(nested).toEqual({ env: { [HOLDER_ID_ENV]: ready.id }, holder: Option.some(ready) });

		rmSync(lock);
		const fresh = yield* withHeavyLock(holding(lock), { lockPath: lock }).pipe(Effect.provide(services({ [HOLDER_ID_ENV]: ready.id })));
		expect(Option.map(fresh.holder, ({ id }) => id)).not.toEqual(Option.some(ready.id));
		expect(fresh.env).toEqual({ [HOLDER_ID_ENV]: Option.getOrThrow(fresh.holder).id });
	}).pipe(Effect.provide(services())),
);

it.effect("a lock taken inside a held lock joins the hold instead of waiting for itself", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const [outer, inner] = yield* withHeavyLock(Effect.zip(holding(lock), withHeavyLock(holding(lock), { lockPath: lock })), { lockPath: lock }).pipe(
			Effect.timeout("5 seconds"),
		);

		expect(inner).toEqual(outer);
		expect(readLock(lock)).toBeUndefined();
	}).pipe(Effect.provide(services())),
);

it.effect("a failing effect releases the lock and keeps its own error", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const error = yield* withHeavyLock(Effect.fail("build failed"), { lockPath: lock }).pipe(Effect.flip);

		expect(error).toBe("build failed");
		expect(readLock(lock)).toBeUndefined();
	}).pipe(Effect.provide(services())),
);

it.effect("a layer holds the lock for as long as it is in use", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const inside = yield* Effect.scoped(Effect.flatMap(Layer.build(heavyLockLayer({ lockPath: lock })), () => Effect.sync(() => readLock(lock))));

		expect(inside).toMatch(/"command":"/u);
		expect(readLock(lock)).toBeUndefined();
	}).pipe(Effect.provide(services())),
);

it.live("an interrupted waiter leaves the holder's lock alone and nothing behind", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const build = holder("build");
		yield* tryAcquire(lock, build);

		const waiter = yield* Effect.forkChild(withHeavyLock(Effect.void, { lockPath: lock, pollInterval: "5 millis" }));
		while ((yield* TestConsole.errorLines).length === 0) {
			yield* Effect.sleep("5 millis");
		}
		yield* Fiber.interrupt(waiter);

		expect(yield* readHolder(lock)).toEqual(Option.some(build));
		expect(readLock(lock)).toBe(yield* encodeHolder(build));
		expect(lockDirectory(lock)).toEqual(["heavy-process.lock"]);
	}).pipe(Effect.provide(Layer.merge(services(), TestConsole.layer))),
);

it.live("interrupting the effect under the lock releases it", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const running = yield* Effect.forkChild(withHeavyLock(Effect.never, { lockPath: lock }));
		while (readLock(lock) === undefined) {
			yield* Effect.sleep("5 millis");
		}
		yield* Fiber.interrupt(running);

		expect(readLock(lock)).toBeUndefined();
	}).pipe(Effect.provide(services())),
);
