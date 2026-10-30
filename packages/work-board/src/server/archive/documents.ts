import { Effect, FileSystem, Order, Path, Schema } from "effect";
import type { MetadataDocument } from "#integration/metadata.ts";
import { type Changes, refreshWritten } from "#server/files/changes.ts";

const RETENTION = 14 * 24 * 60 * 60 * 1000;
const ArchivedIdentities = Schema.fromJsonString(Schema.Array(Schema.String));

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
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const stateFile = path.join(root, ".board-archive.json");
	const saved = (yield* fs.exists(stateFile)) ? yield* fs.readFileString(stateFile) : "[]";
	const restored = new Set(yield* Schema.decodeUnknownEffect(ArchivedIdentities)(saved).pipe(Effect.orDie));
	const archived = new Set(documents.filter((document) => document.file.startsWith("archive/")).map(identity));
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
		let chosen = target;
		let suffix = 0;
		while (
			!(yield* fs.link(path.join(root, document.file), path.join(root, chosen)).pipe(
				Effect.as(true),
				Effect.catchIf(
					(error) => error.reason._tag === "AlreadyExists",
					() => Effect.succeed(false),
				),
			))
		) {
			suffix += 1;
			chosen = `${target.slice(0, -3)}-${suffix}.md`;
		}
		yield* fs.remove(path.join(root, document.file));
		if (chosen.startsWith("archive/")) {
			archived.add(identity({ ...document, file: chosen }));
		} else {
			archived.delete(identity(document));
		}
		moved.push(document.file, chosen);
	}
	const next = JSON.stringify([...archived].sort(Order.String));
	if (next !== saved) {
		yield* fs.writeFileString(stateFile, next);
	}
	return moved;
});

export function refreshArchived(changes: Changes, paths: readonly string[]) {
	return paths.length === 0 ? Effect.void : refreshWritten(changes, paths);
}
