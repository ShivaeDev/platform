import { Effect } from "effect";
import type { MetadataDocument } from "#integration/metadata.ts";
import { archiveDocuments } from "#server/archive/documents.ts";
import { archiveSettled } from "#server/archive/settled.ts";

export const archiveInventory = Effect.fn("WorkBoard.archiveInventory")(function* (
	root: string,
	documents: readonly MetadataDocument[],
	modified: ReadonlyMap<string, number>,
	now: number,
	unavailable: readonly string[],
) {
	if (unavailable.length > 0) {
		return [];
	}
	const moved = yield* archiveDocuments(
		root,
		documents.map((document) => ({ ...document, modified: modified.get(document.file) ?? now })),
		now,
	);
	return [...moved, ...(yield* archiveSettled(root, documents))];
});
