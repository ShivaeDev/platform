import { execFileSync } from "node:child_process";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect, Option } from "effect";
import { TestClock } from "effect/testing";
import { decodeHolder } from "#holder.ts";
import { cli } from "./cli.ts";
import { commands } from "./cliProcess.ts";
import { lockStory } from "./kit.ts";
import { readLock } from "./lock.ts";

export function hungAfter(milliseconds: number) {
	return lockStory.trait("configuration", `waiters warn after a hold lasts ${milliseconds}ms`, (engine) => {
		engine.options = { ...engine.options, hungAfter: `${milliseconds} millis` };
	});
}

export function gitUnavailable() {
	return lockStory.trait("configuration", "the holder can run ps but Git is not on PATH", (engine) => {
		const bin = join(engine.directory, "bin");
		mkdirSync(bin);
		symlinkSync("/bin/ps", join(bin, "ps"));
		engine.env.PATH = bin;
	});
}

export function heldByAnotherProcess(branch?: string, detached = false) {
	return lockStory.trait(
		"holder",
		`another process holds the lock ${branch === undefined ? "outside a Git repository" : `on branch ${branch}`}`,
		(engine) =>
			Effect.gen(function* () {
				const cwd = join(engine.directory, "repository");
				mkdirSync(cwd);
				if (branch !== undefined) {
					execFileSync("git", ["init", "--initial-branch", branch, cwd], { stdio: "ignore" });
					if (detached) {
						execFileSync(
							"git",
							["-C", cwd, "-c", "user.name=Story", "-c", "user.email=story@example.com", "commit", "--allow-empty", "-m", "fixture"],
							{ stdio: "ignore" },
						);
						execFileSync("git", ["-C", cwd, "checkout", "--detach"], { stdio: "ignore" });
					}
				}
				engine.cliOptions.cwd = cwd;
				yield* cli(engine, () => undefined).starts("holder", commands.holdsUntilReleased);
				const holder = Option.getOrThrow(decodeHolder(readLock(engine.lock) ?? ""));
				yield* TestClock.setTime(holder.startedAtMs);
			}),
	);
}
