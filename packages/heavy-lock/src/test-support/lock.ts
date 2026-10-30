import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { ConfigProvider, Effect, FileSystem, Option } from "effect";
import type { HeavyLockOptions } from "#acquire.ts";
import { decodeHolder, type Holder } from "#holder.ts";
import { reclaim, release, tryAcquire } from "#lockFile.ts";
import type { CliRun } from "./cliProcess.ts";
import type { Command, Hold } from "./commands.ts";
import { startTime } from "./startTime.ts";

const LOCK_PATHS = ["explicit", "HEAVY_PROCESS_LOCK", "HOME"] as const;

export type LockPath = (typeof LOCK_PATHS)[number];

export const createLock = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const directory = yield* fs.makeTempDirectoryScoped({ prefix: "heavy-lock-" });
	const lock = join(directory, "nested", "heavy-process.lock");
	const home = join(directory, "home");
	const paths: Record<LockPath, string> = {
		explicit: lock,
		"HEAVY_PROCESS_LOCK": join(directory, "environment", "heavy-process.lock"),
		"HOME": join(home, ".cache", "heavy-process.lock"),
	};
	const options: HeavyLockOptions = { lockPath: lock, pollInterval: "10 seconds" };
	const answers: Record<string, string> = {};
	const cliOptions: { cwd?: string } = {};
	const cliRuns: Record<string, CliRun> = {};
	const commands: Record<string, Command> = {};
	const env: Record<string, string> = {};
	const holders: Record<string, Holder> = {};
	const holds: Record<string, Hold> = {};
	return {
		answers,
		cliOptions,
		cliRuns,
		commands,
		directory,
		env,
		holders,
		holds,
		home,
		lock,
		names: new Map<string, string>(),
		omitsCommand: false,
		options,
		paths,
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

export function nameOf(engine: Lock, id: string, pid?: number): string {
	const cliRun = Object.entries(engine.cliRuns).find(([, run]) => run.pid === pid);
	return engine.names.get(id) ?? cliRun?.[0] ?? "an unknown holder";
}

function holderOf(engine: Lock, path = engine.lock): string {
	const content = readLock(path);
	if (content === undefined) {
		return "nobody";
	}
	return Option.match(decodeHolder(content), { onNone: () => "an unreadable holder", onSome: ({ id, pid }) => nameOf(engine, id, pid) });
}

export const configured = Effect.fn("LockStory.configured")(function* <A, E, R>(engine: Lock, effect: Effect.Effect<A, E, R>) {
	const provider = engine.unreadable ? yield* ConfigProvider.fromDir({ rootPath: engine.directory }) : ConfigProvider.fromEnv({ env: engine.env });
	return yield* Effect.provideService(effect, ConfigProvider.ConfigProvider, provider);
});

export type HolderProcess = "live" | "exited" | "reused";

export function makeHolder(name: string, kind: HolderProcess = "live", startedAtMs = 0): Holder {
	const pid = kind === "exited" ? (spawnSync("/bin/sh", ["-c", ":"]).pid ?? 0) : process.pid;
	return {
		command: `pnpm ${name}`,
		cwd: "/repo",
		id: name,
		pid,
		processStartedAt: kind === "live" ? startTime(pid) : "Thu Jan  1 00:00:00 1970",
		startedAtMs,
	};
}

function answerOf(engine: Lock, blocker: Option.Option<Holder>) {
	return Option.match(blocker, { onNone: () => "took the lock", onSome: ({ id }) => `blocked by ${nameOf(engine, id)}` });
}

export const seedHolder = Effect.fn("LockStory.seedHolder")(function* (engine: Lock, name: string, kind: HolderProcess, startedAtMs: number) {
	const holder = makeHolder(name, kind, startedAtMs);
	engine.holders[name] = holder;
	engine.names.set(holder.id, name);
	const blocker = yield* tryAcquire(engine.lock, holder);
	if (Option.isSome(blocker)) {
		return yield* Effect.die(new Error(`Cannot seed ${name}'s lock: ${answerOf(engine, blocker)}.`));
	}
});

export function lockVerbs(engine: Lock, tell: (line: string) => void) {
	function holder(name: string) {
		const found = engine.holders[name];
		return found === undefined ? Effect.die(new Error(`${name} never held the lock in this story.`)) : Effect.succeed(found);
	}
	return {
		answerOf: (name: string) => Effect.sync(() => engine.answers[name] ?? `${name} never tried`),
		contents: () => Effect.sync(() => readLock(engine.lock)),
		filesBesideLock: () => Effect.sync(() => lockDirectory(engine.lock)),
		holder: (path: LockPath = "explicit") => Effect.sync(() => holderOf(engine, engine.paths[path])),
		lockedPaths: () => Effect.sync(() => LOCK_PATHS.filter((path) => readLock(engine.paths[path]) !== undefined)),
		reclaims: (name: string) =>
			Effect.gen(function* () {
				tell(`a waiter that found ${name} dead reclaims ${name}'s lock`);
				yield* reclaim(engine.lock, Option.some(yield* holder(name)));
			}),
		releases: (name: string) =>
			Effect.gen(function* () {
				tell(`${name} releases the lock`);
				yield* release(engine.lock, engine.holders[name]?.id ?? name);
			}),
		tries: (name: string) =>
			Effect.gen(function* () {
				tell(`${name} tries to take the lock`);
				const attempt = makeHolder(name);
				engine.holders[name] = attempt;
				engine.names.set(attempt.id, name);
				engine.answers[name] = answerOf(engine, yield* tryAcquire(engine.lock, attempt));
			}),
	};
}
