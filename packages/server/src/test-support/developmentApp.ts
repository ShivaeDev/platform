import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { developmentFiles } from "#test/developmentFiles.ts";

function recordStartup(ready: Map<string, { pid: number; value: string }>, line: string): boolean {
	if (!line.startsWith("APP_READY=")) {
		return false;
	}
	const [kind, pid, ...value] = line.slice("APP_READY=".length).split(":");
	if (kind !== undefined) {
		ready.set(kind, { pid: Number(pid), value: value.join(":") });
	}
	return ready.size === 3;
}

export const developmentApp = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "platform-development-" });
		for (const [path, text] of Object.entries(developmentFiles)) {
			yield* fs.writeFileString(join(root, path), text);
		}
		yield* fs.symlink(fileURLToPath(new URL("../../../../node_modules", import.meta.url)), join(root, "node_modules"));
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
		const child = yield* spawner.spawn(ChildProcess.make(process.execPath, ["--conditions=source", "runner.mjs"], { cwd: root }));
		const stderr: string[] = [];
		yield* child.stderr.pipe(
			Stream.decodeText(),
			Stream.splitLines,
			Stream.runForEach((line) => Effect.sync(() => stderr.push(line))),
			Effect.forkScoped,
		);
		return { child, ready: new Map<string, { pid: number; value: string }>(), stderr };
	},
	layer: NodeServices.layer,
	name: "development application",
	stages: [],
	verbs: (engine, story) => ({
		exitCode: () => engine.child.exitCode.pipe(Effect.timeout("10 seconds")),
		finishVite: () => {
			story.tell("Vite exits with its own status");
			return Effect.tryPromise(() => fetch(`${engine.ready.get("vite")?.value}/finish`).then((response) => response.text()));
		},
		remaining: () =>
			[...engine.ready]
				.filter(([, { pid }]) => {
					try {
						process.kill(pid, 0);
						return true;
					} catch {
						return false;
					}
				})
				.map(([kind]) => kind),
		*start() {
			story.tell("start the server, worker and Vite");
			const started = yield* Deferred.make<void>();
			yield* engine.child.stdout.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) => (recordStartup(engine.ready, line) ? Deferred.succeed(started, undefined) : Effect.void)),
				Effect.forkScoped,
			);
			yield* Deferred.await(started).pipe(Effect.timeout("20 seconds"));
		},
		started: () => Object.fromEntries([...engine.ready].map(([kind, entry]) => [kind, entry.value])),
	}),
});
