import { fileUrl } from "#files/url.ts";
import { fleetRecords } from "#server/attention/inbox.ts";
import { identityUrl } from "#server/metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { attentionEntries } from "./attentionEntries.ts";
import type { Entry } from "./entries.ts";

function itemUrl(document: MetadataDocument, model: MetadataModel): string {
	const id = document.parsed.fields.id;
	return model.unavailable.length === 0 && id && model.ids.get(id)?.length === 1 ? identityUrl(id) : fileUrl(document.file);
}
export function metadataEntries(
	entries: readonly Entry[],
	documents: readonly MetadataDocument[],
	model: MetadataModel,
	records: ReadonlySet<string> = fleetRecords(model),
): readonly Entry[] {
	const sources = new Map(documents.map((document) => [document.file, document]));
	const enriched = entries.map((entry) => {
		const document = sources.get(entry.file);
		if (!document) {
			return entry;
		}
		const fields = document.parsed.fields;
		return {
			...entry,
			href: entry.kind === "document" ? itemUrl(document, model) : entry.href,
			text:
				entry.kind === "document"
					? [entry.text, fields.id, fields.kind, fields.status, fields.owner, fields.nextAction].filter(Boolean).join(" ")
					: entry.text,
		};
	});
	for (const document of documents) {
		enriched.push(...attentionEntries(document, itemUrl(document, model)));
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
	return enriched.map((entry) => {
		const fields = sources.get(entry.file)?.parsed.fields;
		return {
			...entry,
			id: fields?.id,
			itemKind: fields?.kind,
			record: records.has(entry.file) || Boolean(fields?.question || fields?.response || fields?.requestReceipt),
			status: fields?.status,
		};
	});
}
