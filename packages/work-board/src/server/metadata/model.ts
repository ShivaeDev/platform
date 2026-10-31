import type { MetadataDocument, MetadataModel } from "#integration/metadata.ts";
import { metadataProblems } from "./problems.ts";

export function documentSource(document: MetadataDocument): string {
	return (document.parsed.raw ?? "") + document.parsed.body;
}

export function metadataModel(documents: readonly MetadataDocument[], unavailable: readonly string[] = [], rootFile?: string): MetadataModel {
	const ids = new Map<string, MetadataDocument[]>();
	for (const document of documents) {
		const id = document.parsed.fields.id;
		if (id) {
			ids.set(id, [...(ids.get(id) ?? []), document]);
		}
	}
	const diagnostics = new Map(documents.map((document) => [document.file, metadataProblems(document, ids, unavailable)]));
	return { diagnostics, documents, ids, rootFile, unavailable };
}
