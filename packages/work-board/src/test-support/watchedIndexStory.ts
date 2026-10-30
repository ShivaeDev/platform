import { renameSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, PubSub, Queue, Stream, SubscriptionRef } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { board } from "#server/integration/board.ts";
import { IndexProgress } from "#server/search/IndexProgress.ts";
import { type Folder, folder } from "./board.ts";
import { type IndexAccesses, watchedIndexFilesystem } from "./watchedIndexFilesystem.ts";

interface Engine extends IndexAccesses {
	index?: Effect.Success<ReturnType<typeof board.watchIndex>>;
	notes: Folder;
	output?: PubSub.Subscription<import("#server/files/changes.ts").Change>;
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
	verbs: (engine, story) => ({
		add: (file: string, source: string) => {
			story.tell(`an editor adds ${file}`);
			engine.notes.write(file, source);
		},
		changeEvents: () => PubSub.takeAll(started(engine).output),
		checkedFiles: () => [...engine.checks],
		checkPasses: () => {
			story.tell("the Board runs its full reconciliation check");
			return started(engine).reconcile;
		},
		clearAccesses: () => {
			engine.checks.length = 0;
			engine.reads.length = 0;
			engine.scans.length = 0;
		},
		edit: (file: string, source: string) => {
			story.tell(`an editor changes ${file} while preserving its timestamp`);
			engine.notes.write(file, source);
			utimesSync(join(engine.notes.root, file), 1, 1);
		},
		move: (from: string, to: string) => {
			story.tell(`an editor moves ${from} to ${to}`);
			renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
		},
		notify: (paths: readonly string[]) => {
			story.tell(`the watcher reports ${paths.join(", ")}`);
			return PubSub.publishAll(
				engine.input,
				paths.flatMap((path) => [
					{ _tag: "Update" as const, path },
					{ _tag: "Update" as const, path },
				]),
			);
		},
		read: () => started(engine).read,
		readFiles: () => engine.reads.map((path) => path.slice(engine.notes.root.length + 1)),
		remove: (file: string) => {
			story.tell(`an editor deletes ${file}`);
			unlinkSync(join(engine.notes.root, file));
		},
		scannedFolders: () => [...engine.scans],
	}),
});

export function indexedBriefs(files: Readonly<Record<string, string>>) {
	return watchedIndexStory.trait("project", "the Board starts with these briefs", (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
			utimesSync(join(engine.notes.root, file), 1, 1);
		}
	});
}
