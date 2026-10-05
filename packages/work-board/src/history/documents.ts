import { metadataParse, type ParsedMetadata } from "#metadata/parse.ts";
import type { Baseline } from "./schema.ts";

export interface HistoryDocument {
	readonly file: string;
	readonly parsed: ParsedMetadata;
	readonly source: string;
}
export function historyDocuments(baseline: Baseline): readonly HistoryDocument[] {
	return baseline.documents.map((document) => ({ ...document, parsed: metadataParse(document.source) }));
}
export function historyIdentities(documents: readonly HistoryDocument[]): ReadonlyMap<string, HistoryDocument | undefined> {
	const ids = new Map<string, HistoryDocument | undefined>();
	for (const document of documents) {
		const id = document.parsed.fields.id;
		if (id) {
			ids.set(id, ids.has(id) ? undefined : document);
		}
	}
	return ids;
}
