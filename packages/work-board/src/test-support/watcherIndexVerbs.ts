import { join } from "node:path";
import { Deferred, Effect } from "effect";
import type { WatcherEngine } from "./fileWatcherStory.ts";

export function watcherIndexVerbs(engine: WatcherEngine, tell: (line: string) => void) {
	return {
		clearReads: () => {
			engine.reads.length = 0;
		},
		holdStat: Effect.fn("Story.holdStat")(function* (file: string) {
			tell(`the filesystem pauses stat for ${file}`);
			engine.hold = { entered: yield* Deferred.make<void>(), path: join(engine.notes.root, file), release: yield* Deferred.make<void>() };
		}),
		listedFiles: () => {
			if (!engine.changes) {
				throw new Error("The watcher has not started");
			}
			return engine.changes.files;
		},
		readIndex: () => {
			tell("a reader requests the board index");
			if (!engine.index) {
				throw new Error("The index has not started");
			}
			return engine.index;
		},
		readPaths: () => [...engine.reads],
		releaseStat: () => {
			tell("the filesystem releases stat");
			if (!engine.hold) {
				throw new Error("No stat is held");
			}
			return Deferred.succeed(engine.hold.release, undefined);
		},
		revision: () => {
			if (!engine.changes) {
				throw new Error("The watcher has not started");
			}
			return engine.changes.revision;
		},
		statEntered: () => {
			if (!engine.hold) {
				throw new Error("No stat is held");
			}
			return Deferred.await(engine.hold.entered);
		},
	};
}
