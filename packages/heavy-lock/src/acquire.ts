import { Crypto, Duration, Effect, type FileSystem, Option, type Path, type Scope } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { currentProcess } from "#adapters/currentProcess.ts";
import { failWith, HeavyLockError } from "./error.ts";
import { HeldLock, type HeldLockShape } from "./HeldLock.ts";
import { HOLDER_ID_ENV } from "./holder.ts";
import { readHolder } from "./lockFile.ts";
import { processStartTime } from "./processStart.ts";
import { readSettings } from "./settings.ts";
import { waitForLock } from "./wait.ts";

export interface HeavyLockOptions {
	readonly command?: string | undefined;
	readonly lockPath?: string | undefined;
	readonly pollInterval?: Duration.Input | undefined;
}

const REMIND_EVERY = Duration.minutes(1);

function heldBy(id: string, lockPath: string): HeldLockShape {
	return { env: { [HOLDER_ID_ENV]: id, "HEAVY_PROCESS_LOCK": lockPath } };
}

const ownStartTime = Effect.fn("HeavyLock.ownStartTime")(function* (pid: number) {
	const started = yield* processStartTime(pid).pipe(Effect.mapError(failWith("Could not run ps to read this process's start time.")));
	if (Option.isNone(started)) {
		return yield* new HeavyLockError({ message: "Could not read this process's start time from ps." });
	}
	return started.value;
});

const acquire = Effect.fn("HeavyLock.acquire")(function* (options: HeavyLockOptions) {
	const settings = yield* readSettings(options.lockPath);
	if (settings.ci) {
		return { env: {} } satisfies HeldLockShape;
	}
	const current = yield* readHolder(settings.lock).pipe(Effect.mapError(failWith(`Could not read the heavy-process lock at ${settings.lock}.`)));
	const inherited = Option.filter(settings.inherited, (id) => Option.exists(current, (currentHolder) => currentHolder.id === id));
	if (Option.isSome(inherited)) {
		return heldBy(inherited.value, settings.lock);
	}
	const self = yield* currentProcess;
	const processStartedAt = yield* ownStartTime(self.pid);
	const crypto = yield* Crypto.Crypto;
	const holderId = yield* crypto.randomUUIDv4().pipe(Effect.mapError(failWith("Could not create the heavy-process lock id.")));
	const holder = yield* waitForLock(
		settings.lock,
		{
			command: options.command ?? self.command,
			cwd: self.cwd,
			id: holderId,
			pid: self.pid,
			processStartedAt,
		},
		{ pollInterval: options.pollInterval ?? Duration.seconds(1), remindEvery: REMIND_EVERY },
	).pipe(Effect.mapError(failWith(`Could not take the heavy-process lock at ${settings.lock}.`)));
	return heldBy(holder.id, settings.lock);
});

export type HeavyLockServices = Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

export function acquireHeavyLock(options: HeavyLockOptions = {}): Effect.Effect<HeldLockShape, HeavyLockError, Scope.Scope | HeavyLockServices> {
	return Effect.flatMap(Effect.serviceOption(HeldLock), (held) => (Option.isSome(held) ? Effect.succeed(held.value) : acquire(options)));
}
