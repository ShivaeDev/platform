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
	verbs: (state, story) => ({
		appConditions: () =>
			Effect.sync(() => ({ server: state.ready.get("server")?.value ?? "not started", worker: state.ready.get("worker")?.value ?? "not started" })),
		runningAppProcesses: () =>
			Effect.sync(() =>
				[...state.ready]
					.filter(([, { pid }]) => {
						try {
							process.kill(pid, 0);
							return true;
						} catch {
							return false;
						}
					})
					.map(([kind]) => kind)
					.sort((left, right) => left.localeCompare(right)),
			),
		*start() {
			story.tell("the development runner starts the server, worker and Vite");
			const started = yield* Deferred.make<void>();
			yield* state.child.stdout.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) => (recordStartup(state.ready, line) ? Deferred.succeed(started, undefined) : Effect.void)),
				Effect.forkScoped,
			);
			yield* Deferred.await(started);
		},
		viteExits: () =>
			Effect.gen(function* () {
				story.tell("Vite exits with status 7");
				yield* Effect.tryPromise(() => fetch(`${state.ready.get("vite")?.value}/finish`).then((response) => response.text()));
				return Number(yield* state.child.exitCode);
			}),
	}),
});
