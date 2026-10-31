import { Effect, FileSystem, Path } from "effect";
import type { MetadataDocument } from "#integration/metadata.ts";
import { documentSource } from "#server/metadata/model.ts";
import { appendCatalogue, readCatalogue, recordPath, type SettledRecord } from "./settledCatalogue.ts";
import { settledPlan } from "./settledPlan.ts";
import { settledRecords } from "./settledRecords.ts";

const moveSettled = Effect.fn("WorkBoard.moveSettled")(
	function* (root: string, document: MetadataDocument, record: SettledRecord) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const source = path.join(root, document.file);
		const target = path.join(root, recordPath(record));
		if ((yield* fs.readFileString(source)) !== documentSource(document)) {
			return [];
		}
		yield* fs.link(source, target).pipe(
			Effect.catchIf(
				(error) => error.reason._tag === "AlreadyExists",
				() => Effect.void,
			),
		);
		if ((yield* fs.readFileString(target)) !== documentSource(document)) {
			return [];
		}
		yield* fs.remove(source).pipe(
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.void,
			),
		);
		return [document.file];
	},
	Effect.catchIf(
		(error) => error.reason._tag === "NotFound",
		() => Effect.succeed<string[]>([]),
	),
);

export const archiveSettled = Effect.fn("WorkBoard.archiveSettled")(function* (root: string, documents: readonly MetadataDocument[]) {
	const ids = new Set(documents.map((document) => document.parsed.fields.id));
	const pending = documents.some(
		({ parsed: { fields } }) =>
			(fields.question && !ids.has(fields.question.item))
			|| (fields.response && !ids.has(fields.response.question))
			|| (fields.requestReceipt && !ids.has(fields.requestReceipt.question)),
	);
	if (!pending && settledRecords(documents).length === 0) {
		return [];
	}
	const catalogue = yield* readCatalogue(root);
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const planned = yield* Effect.filter(settledPlan(documents, catalogue), ({ document }) =>
		fs.readFileString(path.join(root, document.file)).pipe(
			Effect.map((source) => source === documentSource(document)),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(false),
			),
		),
	);
	if (planned.length === 0) {
		return [];
	}
	const existing = new Set(catalogue.map((record) => record.id));
	const added = planned.map(({ record }) => record).filter((record) => !existing.has(record.id));
	// Publish locations before removing sources, so an interrupted move remains discoverable and can finish on the next read.
	yield* appendCatalogue(root, added);
	return (yield* Effect.forEach(planned, ({ document, record }) => moveSettled(root, document, record))).flat();
});
