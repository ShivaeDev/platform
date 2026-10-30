import { Effect, FileSystem, Path } from "effect";
import type { MarkdownFile } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { settledPath } from "./loadSettled.ts";

export const archivedReading = Effect.fn("WorkBoard.archivedReading")(function* (snapshot: Snapshot, url: string) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	const selection = decodeURIComponent(/^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(pathname)?.groups?.id ?? pathname.slice(1));
	return yield* snapshot.archived?.(selection) ?? Effect.succeed(snapshot);
});

export function readingFiles(files: readonly MarkdownFile[], snapshot: Snapshot) {
	const known = new Set(files.map((file) => file.path));
	return [
		...files,
		...snapshot.documents
			.filter((document) => !known.has(document.file))
			.map((document) => ({
				modified: document.modified ?? 0,
				path: document.file,
			})),
	];
}

export const documentPath = Effect.fn("WorkBoard.documentPath")(function* (root: string, realRoot: string, file: string, id?: string) {
	const archived = yield* settledPath(root, file, id);
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const stored = archived && (yield* fs.exists(path.join(realRoot, archived))) ? path.join(realRoot, archived) : undefined;
	if (id && stored) {
		return stored;
	}
	return (yield* markdownPath(root, realRoot, file)) ?? stored;
});
