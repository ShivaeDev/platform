import type { MetadataDocument } from "#server/metadata/model.ts";

const closed = new Set(["closed", "done", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]);

function statusOf(document: MetadataDocument): string {
	return document.parsed.fields.status?.trim().toLowerCase() ?? "";
}

export function closedItem(document: MetadataDocument): boolean {
	return closed.has(statusOf(document));
}

export function deferredItem(document: MetadataDocument): boolean {
	return statusOf(document) === "deferred";
}
