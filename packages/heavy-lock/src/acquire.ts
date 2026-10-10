import { randomUUID } from "node:crypto";
import process from "node:process";
import { Duration, Effect, type FileSystem, Option, type Path, type Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import { failWith, HeavyLockError } from "./error.ts";
import { HeldLock, type HeldLockShape } from "./held-lock.ts";
import { HOLDER_ID_ENV } from "./holder.ts";
import { readHolder } from "./lock-file.ts";
import { processStartTime } from "./process-start.ts";
import { readSettings } from "./settings.ts";
import { waitForLock } from "./wait.ts";

export interface HeavyLockOptions {
	readonly command?: string | undefined;
	readonly lockPath?: string | undefined;
	readonly pollInterval?: Duration.Input | undefined;
}

const REMIND_EVERY = Duration.minutes(1);

function heldBy(id: string): HeldLockShape {
	return { env: { [HOLDER_ID_ENV]: id } };
}

const ownStartTime = Effect.gen(function* () {
	const started = yield* processStartTime(process.pid).pipe(Effect.mapError(failWith("Could not run ps to read this process's start time.")));
	if (Option.isNone(started)) {
		return yield* new HeavyLockError({ message: "Could not read this process's start time from ps." });
	}
	return started.value;
});

const takeLock = Effect.fn("HeavyLock.acquire")(function* (options: HeavyLockOptions) {
	const settings = yield* readSettings(options.lockPath);
	if (settings.ci) {
		return { env: {} } satisfies HeldLockShape;
	}
	const current = yield* readHolder(settings.lock);
	const inherited = Option.filter(settings.inherited, (id) => Option.exists(current, (holder) => holder.id === id));
	if (Option.isSome(inherited)) {
		return heldBy(inherited.value);
	}
	const processStartedAt = yield* ownStartTime;
	const holder = yield* waitForLock(
		settings.lock,
		{
			command: options.command ?? process.argv.slice(1).join(" "),
			cwd: process.cwd(),
			id: randomUUID(),
			pid: process.pid,
			processStartedAt,
		},
		{ pollInterval: options.pollInterval ?? Duration.seconds(1), remindEvery: REMIND_EVERY },
	).pipe(Effect.mapError(failWith(`Could not take the heavy-process lock at ${settings.lock}.`)));
	return heldBy(holder.id);
});

export type HeavyLockServices = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

export const acquireHeavyLock = (options: HeavyLockOptions = {}): Effect.Effect<HeldLockShape, HeavyLockError, Scope.Scope | HeavyLockServices> =>
	Effect.flatMap(Effect.serviceOption(HeldLock), (held) => (Option.isSome(held) ? Effect.succeed(held.value) : takeLock(options)));
