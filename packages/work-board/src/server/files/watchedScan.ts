import { Effect, FileSystem, Path, Stream } from "effect";
import { scanMarkdown } from "./list.ts";

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
	const rootEvents = yield* Stream.toQueue(yield* folderEvents({ real: realRoot, recursive: true, relative: "" }), { capacity: "unbounded" });
	// The root watch registers asynchronously; scanning after it settles leaves no change unseen. Linked folders are watched only once the
	// scan finds them, so their workspace offers no listing and is listed again after those watches settle.
	yield* Effect.sleep(SETTLE);
	const { files, roots } = yield* scanMarkdown(root, realRoot);
	return { files, listing: roots.length > 1 ? undefined : files, rootEvents: Stream.fromQueue(rootEvents), roots };
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
