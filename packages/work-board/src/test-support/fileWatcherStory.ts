import { rmSync } from "node:fs";
import { join, relative } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, PubSub, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { type Change, type Changes, watchChanges } from "#server/files/changes.ts";
import { type Folder, folder } from "./board.ts";

interface WatcherEngine {
	changes?: Changes;
	readonly checked: string[];
	readonly input: PubSub.PubSub<FileSystem.WatchEvent>;
	readonly notes: Folder;
	output?: PubSub.Subscription<Change>;
	scans: number;
	starts: number;
}

export const fileWatcherStory = storyKit({
	after: {
		*project(engine) {
			const fs = yield* FileSystem.FileSystem;
			const boundary = {
				...fs,
				readDirectory: (path: string) =>
					Effect.suspend(() => {
						if (path === engine.notes.root) {
							engine.scans += 1;
						}
						return fs.readDirectory(path);
					}),
				stat: (path: string) =>
					Effect.suspend(() => {
						engine.checked.push(relative(engine.notes.root, path));
						return fs.stat(path);
					}),
				watch: (_path: string, options?: FileSystem.WatchOptions) => {
					if (!options?.recursive) {
						return Stream.never;
					}
					engine.starts += 1;
					return Stream.fromPubSub(engine.input);
				},
			};
			engine.changes = yield* watchChanges(engine.notes.root).pipe(Effect.provideService(FileSystem.FileSystem, boundary));
			engine.output = yield* PubSub.subscribe(engine.changes.events);
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const input = yield* PubSub.unbounded<FileSystem.WatchEvent>();
		const engine: WatcherEngine = { checked: [], input, notes, scans: 0, starts: 0 };
		return engine;
	},
	inspect: (engine) => ({ checked: engine.checked, scans: engine.scans, starts: engine.starts }),
	layer: NodeServices.layer,
	name: "file watcher",
	stages: ["project"],
	verbs: (engine, story) => ({
		get checked() {
			return engine.checked;
		},
		nextChange: () => {
			if (!engine.output) {
				throw new Error("The watcher has not started");
			}
			return PubSub.take(engine.output);
		},
		notify: (paths: readonly string[]) => {
			story.tell(`the filesystem reports ${paths.join(", ")}`);
			return PubSub.publishAll(
				engine.input,
				paths.map((path): FileSystem.WatchEvent => ({ _tag: "Create", path })),
			);
		},
		removeFile: (path: string) => {
			story.tell(`an outside editor removes ${path}`);
			rmSync(join(engine.notes.root, path), { recursive: true });
		},
		get scans() {
			return engine.scans;
		},
		get starts() {
			return engine.starts;
		},
		writeFile: (path: string, source: string) => {
			story.tell(`an outside editor writes ${path}`);
			engine.notes.write(path, source);
		},
	}),
});

export function watchedFiles(files: Readonly<Record<string, string>>) {
	return fileWatcherStory.trait("project", "the project contains the watched files", (engine) => {
		for (const [path, source] of Object.entries(files)) {
			engine.notes.write(path, source);
		}
	});
}
