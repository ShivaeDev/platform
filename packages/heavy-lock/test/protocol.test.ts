import { readFileSync } from "node:fs";
import process from "node:process";
import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { afterEach } from "vitest";
import { decodeHolder, encodeHolder, type Holder } from "#holder.ts";
import { tryAcquire } from "#lock-file.ts";
import { readLock, removeTemporaryDirectories, services, startTime, temporaryLock, writeLock } from "#test/support/lock.ts";
import { withHeavyLock } from "#with-heavy-lock.ts";

afterEach(removeTemporaryDirectories);

const REFERENCE = readFileSync(new URL("./fixtures/reference-holder.lock", import.meta.url), "utf8");
const PROTOCOL_KEYS = ["id", "pid", "processStartedAt", "command", "cwd", "startedAtMs"];

const referenceHolder: Holder = {
	command: 'pnpm --filter "@shivaedev/*" test',
	cwd: "/repo/checkout",
	id: "3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10",
	pid: 4242,
	processStartedAt: "Sat Sep 26 12:00:00 2026",
	startedAtMs: 1_790_409_600_123,
};

it.effect("a holder encodes byte for byte as the protocol fixture, whatever order its fields were given in", () =>
	Effect.gen(function* () {
		const reordered: Holder = {
			command: referenceHolder.command,
			cwd: "/repo/checkout",
			id: referenceHolder.id,
			pid: 4242,
			processStartedAt: referenceHolder.processStartedAt,
			startedAtMs: 1_790_409_600_123,
		};

		expect(yield* encodeHolder(referenceHolder)).toBe(REFERENCE);
		expect(yield* encodeHolder(reordered)).toBe(REFERENCE);
		expect(decodeHolder(REFERENCE)).toEqual(Option.some(referenceHolder));
	}),
);

it.effect("a lock in the reference format naming a live process blocks the lock", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();
		const live = REFERENCE.replace('"pid":4242', `"pid":${process.pid}`).replace(referenceHolder.processStartedAt, startTime(process.pid));
		writeLock(lock, live);

		const blocker = yield* tryAcquire(lock, { ...referenceHolder, id: "waiter" });

		expect(Option.map(blocker, ({ id }) => id)).toEqual(Option.some(referenceHolder.id));
		expect(readLock(lock)).toBe(live);
	}).pipe(Effect.provide(services())),
);

it.effect("the lock this implementation holds follows the protocol's key order and format", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const recorded = yield* withHeavyLock(
			Effect.sync(() => readLock(lock) ?? ""),
			{ command: "pnpm build", lockPath: lock },
		);

		const parsed: unknown = JSON.parse(recorded);
		expect(Object.keys(parsed ?? {})).toEqual(PROTOCOL_KEYS);
		expect(recorded).toMatch(/^\{"id":"[\w-]+","pid":\d+,"processStartedAt":"[^"]+","command":"pnpm build","cwd":"[^"]+","startedAtMs":\d+\}$/u);
		expect(parsed).toMatchObject({ cwd: process.cwd(), pid: process.pid, processStartedAt: startTime(process.pid) });
	}).pipe(Effect.provide(services())),
);
