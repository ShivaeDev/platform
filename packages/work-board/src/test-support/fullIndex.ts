import { Effect, Option } from "effect";
import { listMarkdown } from "#files/list.ts";
import { type MetadataDocument, metadataModel } from "#metadata/model.ts";
import type { Entry } from "#search/entries.ts";
import { metadataEntries } from "#search/metadataEntries.ts";
import { readDocument } from "#search/readDocument.ts";

export const fullIndex = Effect.fn("Test.fullIndex")(function* (root: string, home?: string) {
	const files = yield* listMarkdown(root, root);
	const documents: MetadataDocument[] = [];
	const entries: Entry[] = [];
	const unavailable: string[] = [];
	for (const file of files) {
		const found = yield* Effect.option(readDocument(root, root, file.path, home, file.modified));
		if (Option.isSome(found) && found.value) {
			documents.push(found.value.document);
			entries.push(...found.value.entries);
		} else {
			unavailable.push(file.path);
		}
	}
	const model = metadataModel(documents, unavailable, home ?? files[0]?.path);
	return {
		documents,
		entries: metadataEntries(entries, documents, model),
		model,
		modified: new Map(files.map((file) => [file.path, file.modified])),
		revision: 0,
		unavailable,
	};
});
