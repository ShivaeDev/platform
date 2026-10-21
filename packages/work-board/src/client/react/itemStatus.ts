import { askStatus } from "#browser/document/asks.ts";
import type { Document } from "#browser/document/schema.ts";

export function itemStatus(document: Document): string | undefined {
	const fields = document.metadata;
	if (!fields.id) {
		return undefined;
	}
	const asked = askStatus(document);
	if (asked) {
		return asked;
	}
	if (fields.kind !== "question") {
		return fields.status;
	}
	return document.requestOutcome === "answered" ? "answered" : (fields.status ?? document.requestOutcome);
}
