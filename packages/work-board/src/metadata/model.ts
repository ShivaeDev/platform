import type { Diagnostic, ParsedMetadata } from "./parse.ts";
import { metadataProblems } from "./problems.ts";

export interface MetadataDocument {
	readonly file: string;
	readonly parsed: ParsedMetadata;
}
export interface MetadataModel {
	readonly diagnostics: ReadonlyMap<string, readonly Diagnostic[]>;
	readonly ids: ReadonlyMap<string, readonly MetadataDocument[]>;
	readonly unavailable: readonly string[];
}

export function metadataModel(documents: readonly MetadataDocument[], unavailable: readonly string[] = []): MetadataModel {
	const ids = new Map<string, MetadataDocument[]>();
	for (const document of documents) {
		const id = document.parsed.fields.id;
		if (id) {
			ids.set(id, [...(ids.get(id) ?? []), document]);
		}
	}
	const diagnostics = new Map(documents.map((document) => [document.file, metadataProblems(document, ids, unavailable)]));
	return { diagnostics, ids, unavailable };
}
