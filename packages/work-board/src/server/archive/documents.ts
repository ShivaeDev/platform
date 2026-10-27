import { Effect, FileSystem, Path } from "effect";
import { type Changes, refreshWritten } from "#server/files/changes.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";

const RETENTION = 14 * 24 * 60 * 60 * 1000;

function destination(document: MetadataDocument, now: number) {
	const { kind, status } = document.parsed.fields;
	if (kind !== "task") {
		return undefined;
	}
	const closed = status === "done" || status === "dropped";
	if (document.file.startsWith("archive/")) {
		return closed ? undefined : document.file.replace(/^archive\//u, "tasks/");
	}
	return closed && document.file.startsWith("tasks/") && (document.modified ?? now) <= now - RETENTION
		? document.file.replace(/^tasks\//u, "archive/")
		: undefined;
}

function identity(document: MetadataDocument) {
	return document.parsed.fields.id ?? document.file.replace(/^(?:tasks|archive)\//u, "");
}

export const archiveDocuments = Effect.fn("WorkBoard.archiveDocuments")(function* (
	root: string,
	documents: readonly MetadataDocument[],
	now: number,
	previous: readonly MetadataDocument[] = [],
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const restored = new Set(previous.filter((document) => document.file.startsWith("archive/")).map(identity));
	const moved: string[] = [];
	for (const document of documents) {
		const target = destination(document, now);
		if (target === undefined) {
			continue;
		}
		if (target.startsWith("archive/") && restored.has(identity(document))) {
			yield* fs.utimes(path.join(root, document.file), new Date(now), new Date(now));
			moved.push(document.file);
			continue;
		}
		yield* fs.makeDirectory(path.dirname(path.join(root, target)), { recursive: true });
		yield* fs.link(path.join(root, document.file), path.join(root, target));
		yield* fs.remove(path.join(root, document.file));
		moved.push(document.file, target);
	}
	return moved;
});

export function refreshArchived(changes: Changes, paths: readonly string[]) {
	return paths.length === 0 ? Effect.void : refreshWritten(changes, paths);
}
