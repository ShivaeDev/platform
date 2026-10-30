import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { HOLDER_ID_ENV } from "#holder.ts";
import { cli } from "./cli.ts";
import { TEST_TIMEOUT_MS } from "./cliProcess.ts";
import { acquireInScope, buildLayer, commandVerbs, startCommand } from "./commands.ts";
import { createLock, type HolderProcess, lockDirectory, lockVerbs, readLock, seedHolder, writeLock } from "./lock.ts";
import { protocolVerbs, writeReference } from "./protocol.ts";

export const liveCli = { clock: "live", timeout: TEST_TIMEOUT_MS } as const;

export const lockStory = storyKit({
	create: () => createLock,
	inspect: (engine) => ({ env: engine.env, files: lockDirectory(engine.lock), lock: readLock(engine.lock) }),
	layer: NodeServices.layer,
	name: "heavy lock",
	stages: ["configuration", "holder", "command"],
	verbs: (engine, story) => ({
		cli: cli(engine, story.tell),
		...commandVerbs(engine, story.tell),
		lock: lockVerbs(engine, story.tell),
		protocol: protocolVerbs(engine, story.tell),
	}),
});

const LEFT_BY = {
	exited: "a process that has exited",
	live: "its live process",
	reused: "a pid that a newer process now uses",
} satisfies Record<HolderProcess, string>;

export function heldBy(name: string, kind: HolderProcess = "live") {
	return lockStory.trait("holder", `${name} holds the lock, running pnpm ${name} in /repo with ${LEFT_BY[kind]}`, (engine) =>
		seedHolder(engine, name, kind, 0),
	);
}

export function ci(value: string) {
	return lockStory.trait("configuration", value === "" ? "CI is set but empty" : `CI is "${value}"`, (engine) => {
		engine.env.CI = value;
	});
}

export function inheritsHolderIdOf(name: string) {
	return lockStory.trait("configuration", `${HOLDER_ID_ENV} passes on ${name}'s holder id`, (engine) => {
		engine.env[HOLDER_ID_ENV] = name;
		engine.names.set(name, name);
	});
}

export function locale(value: string) {
	return lockStory.trait("configuration", `LANG and LC_ALL are ${value}`, (engine) => {
		engine.env.LANG = value;
		engine.env.LC_ALL = value;
	});
}

export function pollingEvery(milliseconds: number) {
	return lockStory.trait("configuration", `the lock is polled every ${milliseconds}ms`, (engine) => {
		engine.options = { ...engine.options, pollInterval: `${milliseconds} millis` };
	});
}

export function noPollInterval() {
	return lockStory.trait("configuration", "no polling interval is given", (engine) => {
		engine.options = { ...engine.options, pollInterval: undefined };
	});
}

export function noCommandOption() {
	return lockStory.trait("configuration", "no command is given", (engine) => {
		engine.omitsCommand = true;
	});
}

export function lockPathsFrom(sources: readonly ("explicit" | "HEAVY_PROCESS_LOCK" | "HOME")[]) {
	const described = sources.length === 0 ? "no lock path option, HEAVY_PROCESS_LOCK or HOME is set" : `lock paths come from ${sources.join(", ")}`;
	return lockStory.trait("configuration", described, (engine) => {
		engine.options = { ...engine.options, lockPath: sources.includes("explicit") ? engine.paths.explicit : undefined };
		if (sources.includes("HEAVY_PROCESS_LOCK")) {
			engine.env.HEAVY_PROCESS_LOCK = engine.paths.HEAVY_PROCESS_LOCK;
		}
		if (sources.includes("HOME")) {
			engine.env.HOME = engine.home;
		}
	});
}

export function processArguments(...args: readonly string[]) {
	return lockStory.trait("configuration", `this process runs with the arguments ${args.join(" ")}`, () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const original = process.argv;
				process.argv = [process.execPath, ...args];
				return original;
			}),
			(original) =>
				Effect.sync(() => {
					process.argv = original;
				}),
		),
	);
}

export function unreadableConfiguration() {
	return lockStory.trait("configuration", "reading the CI setting fails because CI is a symbolic link to itself", (engine) => {
		symlinkSync("CI", join(engine.directory, "CI"));
		engine.unreadable = true;
	});
}

export function invalidHolder(kind: "without a process start time" | "that is not JSON") {
	return lockStory.trait("holder", `the lock holds a holder ${kind}`, (engine) => {
		writeLock(
			engine.lock,
			kind === "that is not JSON"
				? "not a holder"
				: JSON.stringify({ command: "pnpm ready", cwd: "/repo", id: "crashed", pid: process.pid, startedAtMs: 0 }),
		);
	});
}

export function referenceLock(owner: "the reference pid" | "this process") {
	return lockStory.trait("holder", `the lock holds the reference file, naming ${owner}`, (engine) => writeReference(engine, owner));
}

export function workingDirectory(cwd: string) {
	return lockStory.trait("configuration", `the CLI runs in ${cwd}`, (engine) => {
		engine.cliOptions.cwd = cwd;
	});
}

export function psFails(how: "missing" | "prints nothing") {
	return lockStory.trait("configuration", how === "missing" ? "ps is not on the PATH" : "ps prints no start time", (engine) => {
		const bin = join(engine.directory, "bin");
		mkdirSync(bin);
		if (how === "prints nothing") {
			writeFileSync(join(bin, "ps"), "#!/bin/sh\nexit 0\n");
			chmodSync(join(bin, "ps"), 0o755);
		}
		engine.env.PATH = bin;
	});
}

function started(name: string, expected: "running" | "waiting", inside?: string) {
	return function* (engine: Effect.Success<typeof createLock>) {
		const command = yield* startCommand(engine, name, inside);
		if (command.state !== expected) {
			return yield* Effect.die(new Error(`${name} was meant to be ${expected} but is ${command.state}.`));
		}
	};
}

export function running(name: string, { inside }: { readonly inside?: string } = {}) {
	return lockStory.trait(
		"command",
		inside === undefined ? `${name} holds the lock and runs` : `${name} runs inside ${inside}'s hold`,
		started(name, "running", inside),
	);
}

export function waiting(name: string) {
	return lockStory.trait("command", `${name} waits for the lock`, started(name, "waiting"));
}

export function acquiredInScope(name: string) {
	return lockStory.trait("command", `${name} acquires the lock in a scope it keeps open`, (engine) => acquireInScope(engine, name));
}

export function layerBuilt(name: string) {
	return lockStory.trait("command", `${name} builds the lock's Layer in a scope it keeps open`, (engine) => buildLayer(engine, name));
}
