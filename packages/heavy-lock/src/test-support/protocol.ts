import { readFileSync } from "node:fs";
import process from "node:process";
import { Effect, Option } from "effect";
import type { Holder } from "#holder.ts";
import { tryAcquire } from "#lock-file.ts";
import { processStartTime } from "#process-start.ts";
import { type Lock, writeLock } from "./lock.ts";

const reference = readFileSync(new URL("./fixtures/reference-holder.lock", import.meta.url), "utf8");
const referenceHolder: Holder = {
	command: 'pnpm --filter "@shivaedev/*" test',
	cwd: "/repo/checkout",
	id: "3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10",
	pid: 4242,
	processStartedAt: "Sat Sep 26 12:00:00 2026",
	startedAtMs: 1_790_409_600_123,
};

export const referenceContent = Effect.fn("LockStory.referenceContent")(function* (engine: Lock) {
	const started = Option.getOrThrow(yield* processStartTime(process.pid));
	writeLock(engine.lock, reference.replace('"pid":4242', `"pid":${process.pid}`).replace(referenceHolder.processStartedAt, started));
});

export function protocolVerbs(engine: Lock) {
	return {
		processIdentity: () =>
			Effect.map(processStartTime(process.pid), (started) => ({
				cwd: process.cwd(),
				pid: process.pid,
				processStartedAt: Option.getOrThrow(started),
			})),
		publishReference: () => tryAcquire(engine.lock, referenceHolder),
		reference,
		referenceHolder,
	};
}
