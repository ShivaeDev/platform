import { Effect, FileSystem, Path, Stream } from "effect";
import { scanMarkdown } from "./list.ts";
import { watchSentinel } from "./watchSentinel.ts";

export type WatchRoots = readonly { readonly real: string; readonly relative: string }[];

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
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const rootEvents = yield* Stream.toQueue(yield* folderEvents({ real: realRoot, recursive: true, relative: "" }), { capacity: "unbounded" });
	// Scanning only after the root watch reports its own sentinel leaves no change unseen. The removal watch, for a root removed without
	// descendant events, starts first because adding a watcher restarts macOS's shared event stream and drops the events in between. Linked
	// folders are watched only once the scan finds them, so their workspace offers no listing and is listed again after those watches settle.
	const removals = yield* Stream.toQueue(
		fs.watch(path.dirname(realRoot)).pipe(
			Stream.filter((event) => event._tag === "Remove" && path.resolve(path.dirname(realRoot), event.path) === realRoot),
			Stream.map(() => ""),
		),
		{ capacity: "unbounded" },
	);
	yield* watchSentinel(realRoot, rootEvents);
	const { files, roots } = yield* scanMarkdown(root, realRoot);
	return {
		files,
		listing: roots.length > 1 ? undefined : files,
		rootEvents: Stream.merge(Stream.fromQueue(rootEvents), Stream.fromQueue(removals)),
		roots,
	};
});

export const rescanFolders = Effect.fn("WorkBoard.rescanFolders")(function* (
	root: string,
	realRoot: string,
	folders: readonly string[],
	roots: WatchRoots,
	contents: ReadonlyMap<string, number>,
) {
	const everything = Effect.map(scanMarkdown(root, realRoot), (scanned) => ({
		contents: new Map(scanned.files.map((file) => [file.path, file.modified])),
		roots: scanned.roots,
	}));
	if (roots.length > 1 || folders.includes("")) {
		return yield* everything;
	}
	const next = new Map([...contents].filter(([file]) => !folders.some((folder) => file.startsWith(`${folder}/`))));
	let found = roots;
	for (const folder of folders) {
		const scanned = yield* scanMarkdown(root, realRoot, folder);
		for (const file of scanned.files) {
			next.set(file.path, file.modified);
		}
		found = [...found, ...scanned.roots.slice(1)];
	}
	// Files no event named may have moved in from elsewhere in the workspace, whose old paths only a full scan finds gone.
	return [...next.keys()].some((file) => !contents.has(file)) ? yield* everything : { contents: next, roots: found };
});
