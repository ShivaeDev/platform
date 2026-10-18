import { renameSync, statSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Ref } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";
import { type Folder, folder } from "./board.ts";
import { incrementalIndex } from "./incrementalIndex.ts";

interface IndexEngine {
	addDuringListing: boolean;
	home?: string;
	index?: Effect.Success<ReturnType<typeof incrementalIndex>>;
	notes: Folder;
	read?: Effect.Success<ReturnType<typeof searchSnapshot>>;
}

function indexed(engine: IndexEngine) {
	if (!(engine.index && engine.read)) {
		throw new Error("The board index has not started");
	}
	return { index: engine.index, read: engine.read };
}

function advancingListing(engine: IndexEngine, index: Effect.Success<ReturnType<typeof incrementalIndex>>) {
	const addFile = Effect.suspend(() => {
		if (!engine.addDuringListing) {
			return Effect.void;
		}
		engine.addDuringListing = false;
		engine.notes.write("added.md", "---\nid: added\n---\n# Added");
		return index.update(["added.md"]);
	});
	return { ...index.changes, files: index.changes.files.pipe(Effect.tap(() => addFile)) };
}

export const indexStory = storyKit({
	after: {
		*project(engine) {
			const index = yield* incrementalIndex(engine.notes.root, engine.home);
			engine.index = index;
			engine.read = engine.addDuringListing ? yield* searchSnapshot(engine.notes.root, engine.home, advancingListing(engine, index)) : index.read();
		},
	},
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const engine: IndexEngine = { addDuringListing: false, notes };
		return engine;
	},
	inspect: (engine) => ({ blocked: [...(engine.index?.blocked ?? [])], reads: engine.index?.reads, root: engine.notes.root }),
	layer: NodeServices.layer,
	name: "board index",
	stages: ["project"],
	verbs: (engine, story) => ({
		blockFile: (file: string) => {
			story.tell(`reading ${file} is denied`);
			indexed(engine).index.blocked.add(join(engine.notes.root, file));
		},
		freshIndex: () => {
			story.tell("an independent full scan reads the same real files");
			return indexed(engine).index.fresh();
		},
		invalidate: (paths?: readonly string[]) => {
			story.tell(paths ? `the index receives changes for ${paths.join(", ")}` : "the index reconciles the folder");
			return indexed(engine).index.update(paths);
		},
		moveFile: (from: string, to: string) => {
			story.tell(`an editor moves ${from} to ${to}`);
			renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
		},
		readIndex: () => {
			story.tell("the reader requests the current board index");
			return indexed(engine).read;
		},
		readPaths: () => [...indexed(engine).index.reads],
		removeFile: (file: string) => {
			story.tell(`an editor removes ${file}`);
			unlinkSync(join(engine.notes.root, file));
		},
		restoreFiles: () => {
			story.tell("file permissions recover");
			indexed(engine).index.blocked.clear();
			indexed(engine).index.reads.length = 0;
		},
		get root() {
			return engine.notes.root;
		},
		setTimestamp: (file: string, atime: number | Date, mtime = atime) => {
			story.tell(`the editor sets the timestamp of ${file}`);
			utimesSync(join(engine.notes.root, file), atime, mtime);
		},
		stopWatching: () => {
			story.tell("the filesystem watcher is unavailable");
			return Ref.set(indexed(engine).index.changes.watching, false);
		},
		timestamp: (file: string) => statSync(join(engine.notes.root, file)),
		writeFile: (file: string, source: string) => {
			story.tell(`an editor writes ${file}`);
			engine.notes.write(file, source);
		},
	}),
});

export function indexedFiles(files: Readonly<Record<string, string>>, modified: ReadonlyMap<string, number> = new Map()) {
	return indexStory.trait("project", `the board indexes ${Object.keys(files).join(", ")}`, (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
		}
		for (const [file, time] of modified) {
			utimesSync(join(engine.notes.root, file), time / 1000, time / 1000);
		}
	});
}

export function aFileAddedDuringListing() {
	return indexStory.trait("project", "a new file arrives during the first listing", (engine) => {
		engine.addDuringListing = true;
	});
}
