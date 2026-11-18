import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Option, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const ANNOUNCED = /recorded to (?<path>\S+traces\.db),/u;
const REFUSED = /and (?<folder>\S+) is not a folder that only this user can reach/u;
const ANOTHER_USER = 65_534;

// Only root can hand a folder to another user.
export const runsAsRoot = process.getuid?.() === 0;

function announcedFolders(output: readonly string[]) {
	return output.flatMap((line) => ANNOUNCED.exec(line)?.groups?.path ?? []).map((path) => dirname(path));
}

function latestFolder(output: readonly string[]) {
	const folder = announcedFolders(output).at(-1);
	return folder === undefined ? Effect.die(new Error("The application has announced no trace store yet")) : Effect.succeed(folder);
}

function described(found: FileSystem.File.Info) {
	if (found.type !== "Directory") {
		return found.type === "SymbolicLink" ? "a link" : `a ${found.type}`;
	}
	const owner = Option.contains(found.uid, process.getuid?.()) ? "this user's" : "another user's";
	return `${owner} folder, mode ${(found.mode & 0o777).toString(8)}`;
}

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
		announcedStoreFolders: () =>
			Effect.flatMap(FileSystem.FileSystem, (fs) => Effect.forEach(announcedFolders(output), (folder) => Effect.map(fs.lstat(folder), described))),
		announcedStores: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const announced = output.flatMap((line) => ANNOUNCED.exec(line)?.groups?.path ?? []);
				return yield* Effect.forEach(announced, (path) =>
					Effect.map(fs.exists(path), (exists) => (exists ? relative(root, path) : `no file at ${path}`)),
				);
			}),
		anotherUserTakesStoreFolder: () =>
			Effect.gen(function* () {
				story.tell("the announced store's folder is handed to another user");
				yield* (yield* FileSystem.FileSystem).chown(yield* latestFolder(output), ANOTHER_USER, ANOTHER_USER);
			}),
		applicationFolder: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readDirectory(join(root, "application"))),
		folderBehindLink: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readDirectory(join(root, "elsewhere"))),
		linkTakesStoreFolderPlace: () =>
			Effect.gen(function* () {
				story.tell("the announced store's folder is removed and a link to another folder takes its name");
				const fs = yield* FileSystem.FileSystem;
				const folder = yield* latestFolder(output);
				yield* fs.remove(folder, { recursive: true });
				yield* fs.makeDirectory(join(root, "elsewhere"));
				yield* fs.symlink(join(root, "elsewhere"), folder);
			}),
		othersGainStoreFolderAccess: () =>
			Effect.gen(function* () {
				story.tell("the announced store's folder is opened to other users");
				yield* (yield* FileSystem.FileSystem).chmod(yield* latestFolder(output), 0o755);
			}),
		refusedStoreFolders: () =>
			Effect.sync(() => output.flatMap((line) => REFUSED.exec(line)?.groups?.folder ?? []).map((folder) => relative(root, folder))),
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
