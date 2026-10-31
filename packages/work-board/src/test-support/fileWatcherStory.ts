import { realpathSync, renameSync, rmSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Fiber, FileSystem, Order, PubSub, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Change, type Changes, watchChanges } from "#server/files/changes.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";
import { type Folder, folder } from "./board.ts";
import { readinessEvents } from "./readinessEvents.ts";

export interface WatcherEngine {
	changes?: Changes;
	readonly checked: string[];
	readonly folders: string[];
	hold?: { path: string; entered: Deferred.Deferred<void>; release: Deferred.Deferred<void> };
	index?: Effect.Success<ReturnType<typeof searchSnapshot>>;
	readonly input: PubSub.PubSub<FileSystem.WatchEvent>;
	readonly notes: Folder;
	output?: PubSub.Subscription<Change>;
	reads: string[];
	reportedAt?: number;
	scans: number;
	starts: number;
	waitingRead?: Fiber.Fiber<Snapshot, unknown>;
	readonly watchedPaths: string[];
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
						engine.folders.push(relative(engine.notes.root, path));
						return fs.readDirectory(path);
					}),
				readFileString: (path: string, encoding?: string) =>
					Effect.suspend(() => {
						engine.reads.push(relative(engine.notes.root, path));
						return fs.readFileString(path, encoding);
					}),
				stat: (path: string) =>
					Effect.gen(function* () {
						engine.checked.push(relative(engine.notes.root, path));
						if (engine.hold?.path === path) {
							yield* Deferred.succeed(engine.hold.entered, undefined);
							yield* Deferred.await(engine.hold.release);
						}
						return yield* fs.stat(path);
					}),
				watch: (path: string, options?: FileSystem.WatchOptions) => {
					if (!options?.recursive) {
						return Stream.never;
					}
					engine.starts += 1;
					engine.watchedPaths.push(path);
					return Stream.merge(readinessEvents(fs, path, options), Stream.fromPubSub(engine.input));
				},
			};
			engine.changes = yield* watchChanges(engine.notes.root).pipe(Effect.provideService(FileSystem.FileSystem, boundary));
			engine.output = yield* PubSub.subscribe(engine.changes.events);
			const read = yield* searchSnapshot(engine.notes.root, undefined, engine.changes).pipe(Effect.provideService(FileSystem.FileSystem, boundary));
			engine.index = read.pipe(Effect.provideService(FileSystem.FileSystem, boundary));
			yield* engine.index;
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const input = yield* PubSub.unbounded<FileSystem.WatchEvent>();
		const engine: WatcherEngine = { checked: [], folders: [], input, notes, reads: [], scans: 0, starts: 0, watchedPaths: [] };
		return engine;
	},
	inspect: (engine) => ({ checked: engine.checked, folders: engine.folders, scans: engine.scans, starts: engine.starts }),
	layer: NodeServices.layer,
	name: "file watcher",
	stages: ["project"],
	verbs: (engine, story) => {
		function watcher() {
			if (!(engine.changes && engine.output && engine.index)) {
				throw new Error("The watcher has not started");
			}
			return { changes: engine.changes, index: engine.index, output: engine.output };
		}
		function read() {
			return watcher().index;
		}
		function relativeTo(paths: readonly string[]) {
			return paths.map((path) => (isAbsolute(path) ? relative(engine.notes.root, path) : path));
		}
		function report(paths: readonly string[]) {
			return Effect.gen(function* () {
				engine.reportedAt = yield* watcher().changes.revision;
				engine.checked.length = 0;
				engine.folders.length = 0;
				engine.reads.length = 0;
				engine.scans = 0;
				yield* PubSub.publishAll(
					engine.input,
					paths.map((path): FileSystem.WatchEvent => ({ _tag: "Create", path })),
				);
			});
		}
		return {
			distinctBodies: () =>
				Effect.map(read(), (snapshot) => {
					story.tell("the reader reads the distinct indexed bodies");
					return [...new Set(snapshot.documents.map((document) => document.parsed.body))];
				}),
			editorMoves: (from: string, to: string) =>
				Effect.sync(() => {
					story.tell(`an outside editor moves ${from} to ${to}`);
					renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
				}),
			editorRemoves: (path: string) =>
				Effect.sync(() => {
					story.tell(`an outside editor removes ${path}`);
					rmSync(join(engine.notes.root, path), { recursive: true });
				}),
			editorWrites: (path: string, source: string) =>
				Effect.sync(() => {
					story.tell(`an outside editor writes ${path}`);
					engine.notes.write(path, source);
				}),
			filesRead: () =>
				Effect.map(read(), () => {
					story.tell("the reader reads the index and checks which files were read since the last report");
					return relativeTo(engine.reads).sort(Order.String);
				}),
			foldersListed: () =>
				Effect.map(read(), () => {
					story.tell("the reader reads the index and checks which folders were listed since the last report");
					return [...engine.folders];
				}),
			indexedPaths: () =>
				Effect.map(read(), (snapshot) => {
					story.tell("the reader reads the indexed paths");
					return snapshot.documents.map((document) => document.file).sort(Order.String);
				}),
			inspectedAmong: (paths: readonly string[]) =>
				Effect.map(read(), () => {
					story.tell(`the reader reads the index and checks which of ${paths.join(", ")} were inspected since the last report`);
					return paths.filter((path) => engine.checked.includes(path));
				}),
			listedPaths: () =>
				Effect.map(watcher().changes.files, (files) => {
					story.tell("the reader reads the watched Markdown listing");
					return files.map((file) => file.path).sort(Order.String);
				}),
			nextAnnouncedChange: () =>
				Effect.map(PubSub.take(watcher().output), (change) => {
					story.tell("the reader waits for the next announced change");
					return "paths" in change ? [...change.paths].sort(Order.String) : `watching: ${change.watching}`;
				}),
			readerStartsReading: () =>
				Effect.gen(function* () {
					story.tell("a reader starts reading the index");
					engine.waitingRead = yield* Effect.forkScoped(read());
					yield* Effect.yieldNow;
				}),
			readersReadAtOnce: (readers: number) =>
				Effect.map(Effect.all(Array.from({ length: readers }, read), { concurrency: "unbounded" }), (snapshots) => {
					story.tell(`${readers} readers read the index at once`);
					return new Set(snapshots).size === 1 ? "one shared snapshot" : `${new Set(snapshots).size} different snapshots`;
				}),
			revisionsAdvanced: () =>
				Effect.map(watcher().changes.revision, (revision) => {
					story.tell("the reader checks how far the revision advanced since the report");
					return revision - (engine.reportedAt ?? revision);
				}),
			rootRescans: () =>
				Effect.map(read(), () => {
					story.tell("the reader reads the index and counts rescans of the workspace root since the last report");
					return engine.scans;
				}),
			statPausesFor: (file: string) =>
				Effect.gen(function* () {
					story.tell(`the filesystem pauses stat for ${file}`);
					engine.hold = { entered: yield* Deferred.make<void>(), path: join(engine.notes.root, file), release: yield* Deferred.make<void>() };
				}),
			statResumes: () => {
				story.tell("the filesystem resumes the paused stat");
				if (!engine.hold) {
					throw new Error("No stat is paused");
				}
				return Deferred.succeed(engine.hold.release, undefined);
			},
			waitingReader: () =>
				Effect.sync(() => {
					story.tell("the reader checks whether the waiting read has answered");
					if (!engine.waitingRead) {
						throw new Error("No reader started reading");
					}
					return engine.waitingRead.pollUnsafe() === undefined ? "still waiting" : "answered";
				}),
			waitingReaderBody: (file: string) =>
				Effect.gen(function* () {
					story.tell(`the waiting reader's answer shows ${file}`);
					if (!engine.waitingRead) {
						throw new Error("No reader started reading");
					}
					const snapshot = yield* Fiber.join(engine.waitingRead);
					return snapshot.documents.find((document) => document.file === file)?.parsed.body;
				}),
			watcherReports: (paths: readonly string[]) => {
				story.tell(`the filesystem reports ${paths.join(", ")}`);
				return report(paths);
			},
			watcherReportsAbsolute: (file: string) => {
				story.tell(`the filesystem reports the absolute real path of ${file}`);
				return report([join(realpathSync(engine.notes.root), file)]);
			},
			watcherReportsWhilePaused: (paths: readonly string[]) =>
				Effect.gen(function* () {
					story.tell(`the filesystem reports ${paths.join(", ")} and the watcher's stat of it pauses`);
					yield* report(paths);
					if (!engine.hold) {
						throw new Error("No stat is paused");
					}
					yield* Deferred.await(engine.hold.entered);
				}),
			watchesStarted: () =>
				Effect.map(read(), () => {
					story.tell("the reader checks which folders a filesystem watch was started on");
					return engine.watchedPaths.map((path) => relative(engine.notes.root, path) || ".");
				}),
		};
	},
});

export function watchedFiles(files: Readonly<Record<string, string>>) {
	return fileWatcherStory.trait(
		"project",
		`the watched project contains ${Object.keys(files).join(", ")} and the board has read its index once`,
		(engine) => {
			for (const [path, source] of Object.entries(files)) {
				engine.notes.write(path, source);
			}
		},
	);
}
