import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";

export function itemIntroduction(parsed: ParsedMetadata): string {
	if (parsed.raw === undefined) {
		return "";
	}
	const fields = parsed.fields;
	return `<div class="item-summary" aria-label="Authored work"><p>Status (source): <b>${escapeHtml(fields.status ?? "Not recorded")}</b>${fields.owner ? ` · Owner: ${escapeHtml(fields.owner)}` : ""}</p><p>Next action: ${escapeHtml(fields.nextAction ?? "Not recorded")}</p></div>`;
}
