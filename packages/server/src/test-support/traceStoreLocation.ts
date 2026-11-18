import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const ANNOUNCED = /recorded to (?<path>\S+traces\.db),/u;

export const traceStoreLocation = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "platform-trace-location-" });
		yield* fs.makeDirectory(join(root, "application"));
		yield* fs.makeDirectory(join(root, "temporary"));
		const output: string[] = [];
		return { output, root };
	},
	layer: NodeServices.layer,
	name: "development trace store location",
	stages: ["files"],
	verbs: ({ output, root }, story) => ({
		announcedStores: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const announced = output.flatMap((line) => ANNOUNCED.exec(line)?.groups?.path ?? []);
				return yield* Effect.forEach(announced, (path) =>
					Effect.map(fs.exists(path), (exists) => (exists ? relative(root, path) : `no file at ${path}`)),
				);
			}),
		applicationFolder: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readDirectory(join(root, "application"))),
		*runsInDevelopment() {
			story.tell("the application runs in development from its folder, records a span and exits");
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const child = yield* spawner.spawn(
				ChildProcess.make(process.execPath, ["--conditions=@shivaedev/source", fileURLToPath(new URL("./tracedProgram.ts", import.meta.url))], {
					cwd: join(root, "application"),
					env: { "NODE_ENV": "development", "TMPDIR": join(root, "temporary") },
				}),
			);
			yield* Stream.merge(child.stdout, child.stderr).pipe(
				Stream.decodeText(),
				Stream.splitLines,
				Stream.runForEach((line) => Effect.sync(() => output.push(line))),
			);
			const exitCode = Number(yield* child.exitCode);
			if (exitCode !== 0) {
				return yield* Effect.die(new Error(`The application exited with code ${exitCode}:\n${output.join("\n")}`));
			}
		},
		traceStores: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const files = yield* fs.readDirectory(root, { recursive: true });
				return files.filter((file) => file.endsWith("traces.db")).sort((left, right) => left.localeCompare(right));
			}),
	}),
});

export function dependenciesInstalled() {
	return traceStoreLocation.trait("files", "the application's folder has a node_modules folder", ({ root }) =>
		Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeDirectory(join(root, "application", "node_modules"))),
	);
}
