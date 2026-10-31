import { renameSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Order, PubSub, Queue, Stream, SubscriptionRef } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { board } from "#server/integration/board.ts";
import { IndexProgress } from "#server/search/IndexProgress.ts";
import { type Folder, folder } from "./board.ts";
import { type IndexAccesses, watchedIndexFilesystem } from "./watchedIndexFilesystem.ts";

interface Engine extends IndexAccesses {
	index?: Effect.Success<ReturnType<typeof board.watchIndex>>;
	notes: Folder;
	output?: PubSub.Subscription<import("#server/files/changes.ts").Change>;
	startup?: import("#server/search/snapshot.ts").Snapshot;
}

function started(engine: Engine) {
	if (!(engine.index && engine.output)) {
		throw new Error("The watched Board index has not started");
	}
	return { ...engine.index, output: engine.output };
}

export const watchedIndexStory = storyKit({
	after: {
		*project(engine) {
			const fs = yield* FileSystem.FileSystem;
			const indexing = yield* SubscriptionRef.make<import("#rpc/Indexing.ts").Indexing | undefined>(undefined);
			const ready = yield* Stream.toQueue(
				SubscriptionRef.changes(indexing).pipe(
					Stream.drop(1),
					Stream.filter((progress) => progress === undefined),
				),
				{ capacity: "unbounded" },
			);
			engine.index = yield* board
				.watchIndex(engine.notes.root)
				.pipe(Effect.provideService(IndexProgress, indexing), Effect.provideService(FileSystem.FileSystem, watchedIndexFilesystem(fs, engine)));
			yield* Queue.take(ready);
			engine.output = yield* PubSub.subscribe(engine.index.changes.events);
			engine.startup = yield* engine.index.read;
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const input = yield* PubSub.unbounded<FileSystem.WatchEvent>();
		const engine: Engine = { checks: [], input, notes, reads: [], scans: [] };
		return engine;
	},
	inspect: (engine) => ({ checks: engine.checks, reads: engine.reads, scans: engine.scans }),
	layer: NodeServices.layer,
	name: "watched Board index",
	stages: ["project"],
	verbs: (engine, story) => {
		function forgetAccesses() {
			engine.checks.length = 0;
			engine.reads.length = 0;
			engine.scans.length = 0;
		}
		function relativeTo(paths: readonly string[]) {
			return paths.map((path) => (path === engine.notes.root ? "." : path.slice(engine.notes.root.length + 1)));
		}
		function current() {
			return started(engine).read;
		}
		return {
			announcedChanges: () =>
				Effect.map(PubSub.takeAll(started(engine).output), (changes) => {
					story.tell("the reader collects the changes the index announced");
					return changes.map((change) => {
						if ("paths" in change) {
							return [...change.paths].sort(Order.String);
						}
						return change.watching ? "watching again" : "not watching";
					});
				}),
			bodyOf: (file: string) =>
				Effect.map(current(), (snapshot) => {
					story.tell(`the reader reads the indexed body of ${file}`);
					return snapshot.documents.find((document) => document.file === file)?.parsed.body ?? "not indexed";
				}),
			editorAdds: (file: string, source: string) =>
				Effect.sync(() => {
					forgetAccesses();
					story.tell(`an editor adds ${file}`);
					engine.notes.write(file, source);
				}),
			editorChanges: (file: string, source: string) =>
				Effect.sync(() => {
					forgetAccesses();
					story.tell(`an editor changes ${file} while preserving its timestamp`);
					engine.notes.write(file, source);
					utimesSync(join(engine.notes.root, file), 1, 1);
				}),
			editorDeletes: (file: string) =>
				Effect.sync(() => {
					forgetAccesses();
					story.tell(`an editor deletes ${file}`);
					unlinkSync(join(engine.notes.root, file));
				}),
			editorMoves: (from: string, to: string) =>
				Effect.sync(() => {
					forgetAccesses();
					story.tell(`an editor moves ${from} to ${to}`);
					renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
				}),
			filesChecked: () =>
				Effect.sync(() => {
					story.tell("the reader checks which paths the index inspected");
					return relativeTo(engine.checks);
				}),
			filesRead: () =>
				Effect.sync(() => {
					story.tell("the reader checks which files the index read");
					return relativeTo(engine.reads);
				}),
			filesWithIdentity: (id: string) =>
				Effect.map(current(), (snapshot) => {
					story.tell(`the reader looks up the files indexed under ${id}`);
					return (snapshot.model.ids.get(id) ?? []).map((document) => document.file);
				}),
			foldersScanned: () =>
				Effect.sync(() => {
					story.tell("the reader checks which folders the index scanned");
					return relativeTo(engine.scans);
				}),
			fullCheckRuns: () => {
				story.tell("the Board runs its full reconciliation check");
				return started(engine).reconcile;
			},
			readerReadsAgain: () =>
				Effect.map(
					Effect.suspend(() => {
						forgetAccesses();
						story.tell("the reader reads the index again");
						return current();
					}),
					(snapshot) => (snapshot === engine.startup ? "the startup snapshot" : "a rebuilt snapshot"),
				),
			watcherReports: (...paths: readonly string[]) => {
				story.tell(`the watcher reports ${paths.join(", ")} twice each`);
				return PubSub.publishAll(
					engine.input,
					paths.flatMap((path) => [
						{ _tag: "Update" as const, path },
						{ _tag: "Update" as const, path },
					]),
				);
			},
		};
	},
});

export function indexedBriefs(files: Readonly<Record<string, string>>) {
	return watchedIndexStory.trait("project", "the Board starts with these briefs", (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
			utimesSync(join(engine.notes.root, file), 1, 1);
		}
	});
}
