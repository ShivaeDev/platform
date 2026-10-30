import type { MetadataDocument } from "#integration/metadata.ts";
import { questionFrom } from "#server/responses/records.ts";

function settledSource(document: MetadataDocument) {
	const { id, kind, question, status, attention } = document.parsed.fields;
	if (
		!id
		|| document.parsed.diagnostics.length > 0
		|| kind !== "question"
		|| question
		|| status === "deferred"
		|| attention?.some((request) => request.state === "open")
	) {
		return false;
	}
	return status === "done" || status === "dropped" || (attention !== undefined && attention.length > 0);
}

export function settledRecords(documents: readonly MetadataDocument[]) {
	const ids = new Map<string, MetadataDocument[]>();
	for (const document of documents) {
		const id = document.parsed.fields.id;
		if (id) {
			ids.set(id, [...(ids.get(id) ?? []), document]);
		}
	}
	const settled = new Map<string, string>();
	for (const document of documents) {
		const { id } = document.parsed.fields;
		if (id && ids.get(id)?.length === 1 && settledSource(document)) {
			settled.set(id, id);
		}
	}
	for (const document of documents) {
		const question = questionFrom(document);
		if (question && settled.has(question.question.item)) {
			settled.set(question.id, question.question.item);
		}
	}
	return documents.flatMap((document) => {
		const { id, response, requestReceipt } = document.parsed.fields;
		const item = settled.get(id ?? "") ?? settled.get(response?.question ?? requestReceipt?.question ?? "");
		return item && id && ids.get(id)?.length === 1 && document.parsed.diagnostics.length === 0 ? [{ document, id, item }] : [];
	});
}
