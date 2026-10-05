import { fileUrl } from "#files/url.ts";
import { identityUrl } from "#metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import type { Entry } from "./entries.ts";

function itemUrl(document: MetadataDocument, model: MetadataModel): string {
	const id = document.parsed.fields.id;
	return model.unavailable.length === 0 && id && model.ids.get(id)?.length === 1 ? identityUrl(id) : fileUrl(document.file);
}
export function metadataEntries(entries: readonly Entry[], documents: readonly MetadataDocument[], model: MetadataModel): readonly Entry[] {
	const sources = new Map(documents.map((document) => [document.file, document]));
	const enriched = entries.map((entry) => {
		const document = sources.get(entry.file);
		if (entry.kind !== "document" || !document) {
			return entry;
		}
		const fields = document.parsed.fields;
		return {
			...entry,
			href: itemUrl(document, model),
			text: [entry.text, fields.id, fields.kind, fields.status, fields.owner, fields.nextAction].filter(Boolean).join(" "),
		};
	});
	for (const document of documents) {
		const criteria = document.parsed.fields.criteria ?? [];
		for (const [index, criterion] of criteria.entries()) {
			if (criteria.filter((item) => item.id === criterion.id).length !== 1) {
				continue;
			}
			const line = document.parsed.lines[`criteria.${index}`] ?? document.parsed.lines.criteria;
			enriched.push({
				file: document.file,
				href: `${itemUrl(document, model)}#criterion-${encodeURIComponent(criterion.id)}`,
				kind: "passage",
				...(line === undefined ? {} : { line }),
				text: criterion.text,
				title: criterion.text,
			});
		}
	}
	return enriched;
}
