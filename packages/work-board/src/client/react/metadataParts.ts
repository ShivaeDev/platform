import type { Document } from "#browser/document/schema.ts";
import { specificSources } from "#browser/document/sourceGroups.ts";
import { criteriaInBody } from "./criteriaInBody.ts";

export function metadataParts(document: Document) {
	return {
		backlinks: specificSources(document.reading?.backlinks ?? []).filter(
			(link) => document.metadata.kind !== "goal" || link.kind !== "Implemented by",
		),
		linksTo: (document.metadata.relationships?.length ?? 0) + (document.metadata.items?.length ?? 0) > 0,
		work:
			document.diagnostics.length > 0
			|| (document.metadata.evidence?.length ?? 0) > 0
			|| (document.metadata.kind !== "goal" && !criteriaInBody(document) && (document.metadata.criteria?.length ?? 0) > 0),
	};
}

export function hasDocumentMetadata(document: Document) {
	const { backlinks, linksTo, work } = metadataParts(document);
	return work || linksTo || backlinks.length > 0 || document.unavailable.length > 0;
}
