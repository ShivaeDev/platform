import { readFileSync } from "node:fs";
import process from "node:process";
import type { Holder } from "#holder.ts";
import { tryAcquire } from "#lockFile.ts";
import { type Lock, writeLock } from "./lock.ts";
import { startTime } from "./startTime.ts";

const reference = readFileSync(new URL("./fixtures/reference-holder.lock", import.meta.url), "utf8");
const referenceHolder: Holder = {
	command: 'pnpm --filter "@shivaedev/*" test',
	cwd: "/repo/checkout",
	id: "3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10",
	pid: 4242,
	processStartedAt: "Sat Sep 26 12:00:00 2026",
	startedAtMs: 1_790_409_600_123,
};

export function referenceContent(engine: Lock) {
	const started = startTime(process.pid);
	writeLock(engine.lock, reference.replace('"pid":4242', `"pid":${process.pid}`).replace(referenceHolder.processStartedAt, started));
}

export function protocolVerbs(engine: Lock) {
	return {
		processIdentity: () => ({ cwd: process.cwd(), pid: process.pid, processStartedAt: startTime(process.pid) }),
		publishReference: (holder: Holder = referenceHolder) => tryAcquire(engine.lock, holder),
		reference,
		referenceHolder,
	};
}
