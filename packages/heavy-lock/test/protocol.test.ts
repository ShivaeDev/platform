import { readFileSync } from "node:fs";
import process from "node:process";
import { expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { afterEach } from "vitest";
import { decodeHolder, encodeHolder, type Holder } from "../src/holder.ts";
import { tryAcquire } from "../src/lock-file.ts";
import { withHeavyLock } from "../src/with-heavy-lock.ts";
import { readLock, removeTemporaryDirectories, services, startTime, temporaryLock, writeLock } from "./support/lock.ts";

afterEach(removeTemporaryDirectories);

const REFERENCE = readFileSync(new URL("./fixtures/reference-holder.lock", import.meta.url), "utf8");
const PROTOCOL_KEYS = ["id", "pid", "processStartedAt", "command", "cwd", "startedAtMs"];

const referenceHolder: Holder = {
	id: "3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10",
	pid: 4242,
	processStartedAt: "Sat Sep 26 12:00:00 2026",
	command: 'pnpm --filter "@shivaedev/*" test',
	cwd: "/repo/checkout",
	startedAtMs: 1790409600123,
};

it.effect("a holder encodes byte for byte as the reference implementation wrote it, whatever order its fields were given in", () =>
	Effect.gen(function* () {
		const reordered: Holder = {
			startedAtMs: 1790409600123,
			cwd: "/repo/checkout",
			command: referenceHolder.command,
			processStartedAt: referenceHolder.processStartedAt,
			pid: 4242,
			id: referenceHolder.id,
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

it.effect("the lock this implementation holds is what a reference reader accepts as live", () =>
	Effect.gen(function* () {
		const lock = temporaryLock();

		const recorded = yield* withHeavyLock(
			Effect.sync(() => readLock(lock) ?? ""),
			{ lockPath: lock, command: "pnpm build" },
		);

		const parsed: unknown = JSON.parse(recorded);
		expect(Object.keys(parsed ?? {})).toEqual(PROTOCOL_KEYS);
		expect(recorded).toMatch(/^\{"id":"[\w-]+","pid":\d+,"processStartedAt":"[^"]+","command":"pnpm build","cwd":"[^"]+","startedAtMs":\d+\}$/);
		expect(parsed).toMatchObject({ pid: process.pid, processStartedAt: startTime(process.pid), cwd: process.cwd() });
	}).pipe(Effect.provide(services())),
);
