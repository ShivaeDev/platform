import { escapeHtml } from "#browser/escapeHtml.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";

export function itemIntroduction(parsed: ParsedMetadata): string {
	if (parsed.raw === undefined) {
		return "";
	}
	const fields = parsed.fields;
	return `<div class="item-summary" aria-label="Authored work">${fields.status ? `<p>Status: <b>${escapeHtml(fields.status)}</b></p>` : ""}${fields.owner ? `<p>Owner: ${escapeHtml(fields.owner)}</p>` : ""}${fields.nextAction ? `<p>Next action: ${escapeHtml(fields.nextAction)}</p>` : ""}</div>`;
}
