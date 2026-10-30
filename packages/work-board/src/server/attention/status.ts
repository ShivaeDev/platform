import { closedStatus, deferredStatus } from "#browser/views/workStatus.ts";
import type { MetadataDocument } from "#integration/metadata.ts";

export function closedItem(document: MetadataDocument): boolean {
	return closedStatus(document.parsed.fields.status);
}

export function deferredItem(document: MetadataDocument): boolean {
	return deferredStatus(document.parsed.fields.status);
}
