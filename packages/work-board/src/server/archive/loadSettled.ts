import { Effect, FileSystem, Path } from "effect";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { documentSource, metadataModel } from "#server/metadata/model.ts";
import { readDocument } from "#server/search/readDocument.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { readCatalogue, recordPath } from "./settledCatalogue.ts";

export const loadSettled = Effect.fn("WorkBoard.loadSettled")(function* (root: string, snapshot: Snapshot, selection: string) {
	const catalogue = yield* readCatalogue(root);
	const groups = new Set(catalogue.filter((record) => record.id === selection || record.file === selection).map((record) => record.item));
	groups.add(selection);
	const selected = snapshot.documents.find((document) => document.file === selection)?.parsed.fields.id;
	if (selected) {
		groups.add(selected);
	}
	for (const record of catalogue) {
		if (record.targets.some((target) => groups.has(target))) {
			groups.add(record.item);
		}
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const records = catalogue.filter((record) => groups.has(record.item) || record.targets.some((target) => groups.has(target)));
	if (records.length === 0) {
		return snapshot;
	}
	const loaded = yield* Effect.forEach(records, (record) =>
		Effect.gen(function* () {
			const stored = recordPath(record);
			const physical = (yield* fs.exists(path.join(root, stored))) ? stored : record.file;
			return yield* readDocument(root, root, record.file, undefined, record.modified, undefined, () =>
				Effect.succeed(path.join(root, physical)),
			).pipe(Effect.catchTag("UnknownError", (error) => Effect.fail(new InternalServerError({ message: error.message }))));
		}),
	);
	const found = loaded.filter((record) => record !== undefined);
	const selectedRecord = records.find((record) => record.id === selection);
	const documents = snapshot.documents.filter(
		(document) => !selectedRecord || document.file !== selectedRecord.file || document.parsed.fields.id === selectedRecord.id,
	);
	for (const { document } of found) {
		if (!documents.some((entry) => entry.file === document.file && documentSource(entry) === documentSource(document))) {
			documents.push(document);
		}
	}
	return {
		...snapshot,
		documents,
		entries: [...snapshot.entries, ...found.flatMap((record) => record.entries)],
		model: metadataModel(documents, snapshot.unavailable, snapshot.model.rootFile),
		modified: new Map([...snapshot.modified, ...records.map((record) => [record.file, record.modified] as const)]),
	};
});

export const settledPath = Effect.fn("WorkBoard.settledPath")(function* (root: string, file: string, id?: string) {
	const catalogue = yield* readCatalogue(root);
	const record = catalogue.find((entry) => entry.file === file && (id === undefined || entry.id === id));
	return record ? recordPath(record) : undefined;
});
