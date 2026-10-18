import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { ConfigProvider, Effect, FileSystem, Option } from "effect";
import type { HeavyLockOptions } from "#acquire.ts";
import type { Holder } from "#holder.ts";
import { readHolder, reclaim, release, tryAcquire } from "#lock-file.ts";
import { processStartTime } from "#process-start.ts";

export const createLock = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "heavy-lock-" });
	const lock = join(directory, "nested", "heavy-process.lock");
	const env: Record<string, string> = {};
	const holders: Record<string, Holder> = {};
	return {
		directory,
		env,
		holders,
		lock,
		options: { command: "pnpm ready", lockPath: lock, pollInterval: "10 seconds" } satisfies HeavyLockOptions,
		unreadable: false,
	};
});

export type Lock = Effect.Success<typeof createLock>;

export function readLock(lock: string): string | undefined {
	return existsSync(lock) ? readFileSync(lock, "utf8") : undefined;
}

export function writeLock(lock: string, content: string): void {
	mkdirSync(dirname(lock), { recursive: true });
	writeFileSync(lock, content);
}

export function lockDirectory(lock: string): readonly string[] {
	return existsSync(dirname(lock)) ? readdirSync(dirname(lock)) : [];
}

export const configured = Effect.fn("LockStory.configured")(function* <A, E, R>(engine: Lock, effect: Effect.Effect<A, E, R>) {
	const provider = engine.unreadable ? yield* ConfigProvider.fromDir({ rootPath: engine.directory }) : ConfigProvider.fromEnv({ env: engine.env });
	return yield* Effect.provideService(effect, ConfigProvider.ConfigProvider, provider);
});

export const makeHolder = Effect.fn("LockStory.makeHolder")(function* (id: string, kind: "live" | "stale" | "reused" = "live", startedAtMs = 0) {
	const pid = kind === "stale" ? (spawnSync("/bin/sh", ["-c", ":"]).pid ?? 0) : process.pid;
	const started = yield* processStartTime(pid);
	return {
		command: `pnpm ${id}`,
		cwd: "/repo",
		id,
		pid,
		processStartedAt: kind === "reused" ? "Thu Jan  1 00:00:00 1970" : Option.getOrElse(started, () => "never"),
		startedAtMs,
	} satisfies Holder;
});

export const seedHolder = Effect.fn("LockStory.seedHolder")(function* (
	engine: Lock,
	id: string,
	kind: "live" | "stale" | "reused",
	startedAtMs: number,
) {
	const holder = yield* makeHolder(id, kind, startedAtMs);
	engine.holders[id] = holder;
	yield* tryAcquire(engine.lock, holder);
});

export function breakConfiguration(engine: Lock): void {
	symlinkSync("CI", join(engine.directory, "CI"));
	engine.unreadable = true;
}

export function lockVerbs(engine: Lock, tell: (line: string) => void) {
	return {
		acquire: (id: string) =>
			Effect.gen(function* () {
				tell(`${id} tries to acquire the lock`);
				const holder = yield* makeHolder(id);
				engine.holders[id] = holder;
				return yield* tryAcquire(engine.lock, holder);
			}),
		contents: () => readLock(engine.lock),
		files: () => lockDirectory(engine.lock),
		holder: (id: string) => engine.holders[id],
		read: () => readHolder(engine.lock),
		reclaim: (id: string) => {
			tell(`a waiter reclaims ${id}'s lock`);
			return reclaim(engine.lock, Option.fromUndefinedOr(engine.holders[id]));
		},
		release: (id: string) => {
			tell(`${id} releases the lock`);
			return release(engine.lock, id);
		},
		replace: (id: string, startedAtMs: number) =>
			seedHolder(engine, id, "live", startedAtMs).pipe(Effect.andThen(Effect.sync(() => writeLock(engine.lock, JSON.stringify(engine.holders[id]))))),
	};
}
