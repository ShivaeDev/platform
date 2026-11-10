import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { isolatedGit } from "@shivaedev/test-story/server/adapters/isolatedGit.ts";
import { cli } from "#test/cli.ts";
import { commands } from "#test/cliCommands.ts";
import { lockStory } from "#test/kit.ts";

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

function repositoryOn(cwd: string, branch: string, detached: boolean) {
	const steps = [
		["init", "--quiet", "--initial-branch", branch],
		...(detached
			? [
					["-c", "user.name=Story", "-c", "user.email=story@example.com", "commit", "--allow-empty", "-m", "fixture"],
					["checkout", "--detach"],
				]
			: []),
	];
	for (const args of steps) {
		const result = isolatedGit(cwd, args);
		if (result.status !== 0) {
			return Effect.die(new Error(`git ${args.join(" ")} failed: ${result.stderr}`));
		}
	}
	return Effect.void;
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
					yield* repositoryOn(cwd, branch, detached);
				}
				engine.cliOptions.cwd = cwd;
				yield* cli(engine, () => undefined).starts("holder", commands.holdsUntilReleased);
			}),
	);
}
