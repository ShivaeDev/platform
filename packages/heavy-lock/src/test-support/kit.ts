import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { acquisition } from "./acquisition.ts";
import { cli } from "./cli.ts";
import { clock } from "./clock.ts";
import { breakConfiguration, createLock, lockDirectory, lockVerbs, readLock, seedHolder, writeLock } from "./lock.ts";
import { protocolVerbs, referenceContent } from "./protocol.ts";

export const lockStory = storyKit({
	create: () => createLock,
	inspect: (engine) => ({ env: engine.env, files: lockDirectory(engine.lock), lock: readLock(engine.lock) }),
	layer: NodeServices.layer,
	name: "heavy lock",
	stages: ["configuration", "holder"],
	verbs: (engine, story) => ({
		cli: cli(engine, story.tell),
		clock: clock(engine, story.tell),
		lock: lockVerbs(engine, story.tell),
		protocol: protocolVerbs(engine),
		run: acquisition(engine, story.tell),
	}),
});

export function heldBy(id: string, kind: "live" | "stale" | "reused" = "live", startedAtMs = 0) {
	return lockStory.trait("holder", `${id} holds the lock with a ${kind} process`, (engine) => seedHolder(engine, id, kind, startedAtMs));
}

export function environment(env: Record<string, string>) {
	return lockStory.trait("configuration", `the environment is ${JSON.stringify(env)}`, (engine) => {
		Object.assign(engine.env, env);
	});
}

export function unreadableConfiguration() {
	return lockStory.trait("configuration", "the configuration directory cannot be read", breakConfiguration);
}

export function invalidHolder(kind: "unversioned" | "malformed") {
	return lockStory.trait("holder", `the lock contains a ${kind} holder`, (engine) => {
		writeLock(
			engine.lock,
			kind === "malformed"
				? "not a holder"
				: JSON.stringify({ command: "pnpm ready", cwd: "/repo", id: "unversioned", pid: process.pid, startedAtMs: 0 }),
		);
	});
}

export function referenceLock() {
	return lockStory.trait("holder", "the reference protocol names a live holder", (engine) => referenceContent(engine));
}

export function workingDirectory(cwd: string) {
	return lockStory.trait("configuration", `the CLI runs in ${cwd}`, (engine) => {
		engine.cliOptions.cwd = cwd;
	});
}

export function processLookupFails(mode: "missing" | "empty") {
	return lockStory.trait("configuration", `ps is ${mode === "missing" ? "missing" : "empty"}`, (engine) => {
		const bin = join(engine.directory, "bin");
		mkdirSync(bin);
		if (mode === "empty") {
			writeFileSync(join(bin, "ps"), "#!/bin/sh\nexit 0\n");
			chmodSync(join(bin, "ps"), 0o755);
		}
		engine.env.PATH = bin;
	});
}
