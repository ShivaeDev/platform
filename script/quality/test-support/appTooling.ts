import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { starterModules, toolingFiles } from "#quality/test-support/appToolingFiles.ts";

function listenBackend(): Promise<ReturnType<typeof createServer>> {
	return new Promise((resolve, reject) => {
		const backend = createServer((request, response) => {
			response.end(`${request.url}|${request.headers.host}`);
		});
		backend.once("error", reject);
		backend.listen(3000, "127.0.0.1", () => resolve(backend));
	});
}

export const appTooling = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "quality-app-tooling-" });
		yield* fs.makeDirectory(join(root, "src"));
		for (const [path, text] of Object.entries(toolingFiles)) {
			yield* fs.writeFileString(join(root, path), text);
		}
		yield* fs.symlink(starterModules, join(root, "node_modules"));
		return { root, url: "" };
	},
	layer: NodeServices.layer,
	name: "application tooling",
	stages: [],
	verbs: (engine, story) => ({
		build: () => {
			story.tell("build the application with its shared Vite config");
			return Effect.sync(() =>
				spawnSync(process.execPath, ["--conditions=source", join(starterModules, "vite/bin/vite.js"), "build"], {
					cwd: engine.root,
					encoding: "utf8",
				}),
			);
		},
		readBuild: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(join(engine.root, "dist/index.html"))),
		request: (path: string) => Effect.tryPromise(() => fetch(new URL(path, engine.url)).then((response) => response.text())),
		runTests: () => {
			story.tell("run the application's DOM stories with the shared test config");
			return Effect.sync(() =>
				spawnSync(process.execPath, ["--conditions=source", join(starterModules, "vitest/vitest.mjs"), "run", "--reporter", "verbose"], {
					cwd: engine.root,
					encoding: "utf8",
				}),
			);
		},
		*serve() {
			story.tell("serve the application and its backend");
			yield* Effect.acquireRelease(Effect.promise(listenBackend), (backend) =>
				Effect.promise(() => new Promise<void>((resolve, reject) => backend.close((error) => (error ? reject(error) : resolve())))),
			);
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(ChildProcess.make(process.execPath, ["--conditions=source", "serve.mjs"], { cwd: engine.root }));
			const address = yield* Deferred.make<string>();
			yield* child.stdout.pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) => (line.startsWith("VITE_URL=") ? Deferred.succeed(address, line.slice("VITE_URL=".length)) : Effect.void)),
				Effect.forkScoped,
			);
			engine.url = yield* Deferred.await(address).pipe(Effect.timeout("20 seconds"));
		},
		typecheck: () => {
			story.tell("typecheck a React application with the shared app preset");
			return Effect.sync(() => spawnSync(join(starterModules, ".bin/tsc"), ["--noEmit"], { cwd: engine.root, encoding: "utf8" }));
		},
	}),
});
