import { readFileSync } from "node:fs";
import process from "node:process";
import { Effect, Option } from "effect";
import { decodeHolder, type Holder } from "#holder.ts";
import { tryAcquire } from "#lockFile.ts";
import { type Lock, readLock, writeLock } from "./lock.ts";
import { startTime } from "./startTime.ts";

export const REFERENCE_HOLDER = "the reference holder";

const reference = readFileSync(new URL("./fixtures/reference-holder.lock", import.meta.url), "utf8");
const referenceHolder: Holder = {
	command: 'pnpm --filter "@shivaedev/*" test',
	cwd: "/repo/checkout",
	id: "3f1c9a52-0d4e-4b8f-9a71-5c2e8d6b4f10",
	pid: 4242,
	processStartedAt: "Sat Sep 26 12:00:00 2026",
	startedAtMs: 1_790_409_600_123,
};

function startedAtMsFirst({ startedAtMs, ...rest }: Holder): Holder {
	return { startedAtMs, ...rest };
}

export function writeReference(engine: Lock, owner: "the reference pid" | "this process") {
	engine.names.set(referenceHolder.id, REFERENCE_HOLDER);
	const { pid, processStartedAt } = thisProcess();
	writeLock(
		engine.lock,
		owner === "the reference pid"
			? reference
			: reference.replace(`"pid":${referenceHolder.pid}`, `"pid":${pid}`).replace(referenceHolder.processStartedAt, processStartedAt),
	);
}

function thisProcess() {
	return { cwd: process.cwd(), pid: process.pid, processStartedAt: startTime(process.pid) };
}

export function protocolVerbs(engine: Lock, tell: (line: string) => void) {
	return {
		publishes: ({ startedAtMs }: { readonly startedAtMs: "last" | "first" }) =>
			Effect.gen(function* () {
				tell(`the reference holder is published with startedAtMs as its ${startedAtMs} field`);
				engine.names.set(referenceHolder.id, REFERENCE_HOLDER);
				const blocker = yield* tryAcquire(engine.lock, startedAtMs === "first" ? startedAtMsFirst(referenceHolder) : referenceHolder);
				if (Option.isSome(blocker)) {
					return yield* Effect.die(new Error("The reference holder found the lock already held."));
				}
			}),
		recordedHolder: () =>
			Effect.sync(() => {
				const content = readLock(engine.lock);
				return content === undefined ? "nothing" : Option.getOrElse(decodeHolder(content), () => "an unreadable holder");
			}),
		reference,
		referenceHolder,
		thisProcess: () => Effect.sync(thisProcess),
	};
}
