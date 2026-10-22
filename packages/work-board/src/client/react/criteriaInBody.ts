import type { Document } from "#browser/document/schema.ts";

const LONG_CRITERIA = { characters: 320, count: 3 };

export function criteriaInBody(document: Document) {
	const criteria = document.metadata.criteria ?? [];
	const characters = criteria.reduce((total, entry) => total + entry.text.length, 0);
	return (
		document.metadata.kind !== "goal" && !document.reading?.board && (criteria.length > LONG_CRITERIA.count || characters > LONG_CRITERIA.characters)
	);
}
