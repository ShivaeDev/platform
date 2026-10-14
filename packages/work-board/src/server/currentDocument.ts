import type { MetadataDocument } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { updateModel } from "#server/metadata/updateModel.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

interface CurrentDocument {
	readonly document: MetadataDocument;
	readonly snapshot: Snapshot;
}

export function currentDocument(snapshot: Snapshot, file: string, source: string, rootFile?: string): CurrentDocument {
	const indexed = snapshot.documents.find((entry) => entry.file === file);
	if (indexed && source === (indexed.parsed.raw ?? "") + indexed.parsed.body) {
		return { document: indexed, snapshot };
	}
	const document: MetadataDocument = { file, parsed: metadataParse(source) };
	const documents = snapshot.documents.map((entry) => (entry.file === file ? document : entry));
	if (!indexed) {
		documents.push(document);
	}
	const model = updateModel(snapshot.model, documents, snapshot.unavailable, rootFile);
	return { document, snapshot: { ...snapshot, documents, model } };
}
