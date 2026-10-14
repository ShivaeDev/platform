import { escapeHtml } from "#browser/escapeHtml.ts";
import { backlinksOf } from "#server/metadata/backlinks.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import { relationshipLabel } from "#server/metadata/relationshipLabel.ts";
import { documentReference } from "./metadataLinks.ts";

export function backlinksHtml(file: string, model: MetadataModel): string {
	const links = backlinksOf(file, model);
	if (links.length === 0) {
		return "";
	}
	const entries = [...new Map(links.map((link) => [`${link.file}:${link.kind}:${link.line ?? ""}`, link])).values()];
	const incomplete =
		model.unavailable.length > 0
			? "<p>Available source references only; unreadable files prevent complete backlink and identity validation.</p>"
			: "";
	return `<section class="work-context" aria-label="Source backlinks"><h3>Referenced by (${entries.length})</h3>${incomplete}<ul>${entries.map((link) => `<li>${escapeHtml(relationshipLabel(link.kind))}: <a href="${escapeHtml(documentReference(link.file, model))}">${escapeHtml(link.file)}${link.line === undefined ? "" : `:${link.line}`}</a></li>`).join("")}</ul><p>These are explicit source links, not inferred blockers or workflow rules.</p></section>`;
}
