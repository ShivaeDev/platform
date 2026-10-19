import { Effect, FileSystem, Path, Stream } from "effect";
import { scanMarkdown } from "./list.ts";

export const SETTLE = "100 millis";

export interface WatchedFolder {
	readonly real: string;
	readonly recursive: boolean;
	readonly relative: string;
}

export const folderEvents = Effect.fn("WorkBoard.folderEvents")(function* (folder: WatchedFolder) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	return fs.watch(folder.real, { recursive: folder.recursive }).pipe(
		Stream.map((event) => {
			const local = path.isAbsolute(event.path) ? path.relative(folder.real, event.path) : event.path;
			return path.join(folder.relative, local).split(path.sep).join("/");
		}),
	);
});

export const watchedScan = Effect.fn("WorkBoard.watchedScan")(function* (root: string, realRoot: string) {
	const rootEvents = yield* Stream.toQueue(yield* folderEvents({ real: realRoot, recursive: true, relative: "" }), { capacity: "unbounded" });
	// The root watch registers asynchronously; scanning after it settles leaves no change unseen. Linked folders are watched only once the
	// scan finds them, so their workspace offers no listing and is listed again after those watches settle.
	yield* Effect.sleep(SETTLE);
	const { files, roots } = yield* scanMarkdown(root, realRoot);
	return { files, listing: roots.length > 1 ? undefined : files, rootEvents: Stream.fromQueue(rootEvents), roots };
});
