import { specificSources } from "#browser/document/sourceGroups.ts";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { backlinksOf } from "#server/metadata/backlinks.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import { relationshipLabel } from "#server/metadata/relationshipLabel.ts";
import { documentReference } from "./metadataLinks.ts";
import { sourceListHtml, sourceTitle } from "./sourceListHtml.ts";

export function backlinksHtml(file: string, model: MetadataModel): string {
	const links = specificSources(
		backlinksOf(file, model).map((link) => ({
			href: documentReference(link.file, model),
			kind: relationshipLabel(link.kind),
			label: link.file + (link.line === undefined ? "" : `:${link.line}`),
			title: sourceTitle(link.file, model),
		})),
	);
	if (links.length === 0) {
		return "";
	}
	const incomplete =
		model.unavailable.length > 0
			? "<p>Available source references only; unreadable files prevent complete backlink and identity validation.</p>"
			: "";
	const groups = [...Map.groupBy(links, (link) => link.kind)]
		.map(
			([kind, sources]) =>
				`<section aria-label="${escapeHtml(kind)} backlinks"><h4>${escapeHtml(kind)} (${sources.length})</h4>${sourceListHtml(sources)}</section>`,
		)
		.join("");
	return `<section class="work-context" aria-label="Source backlinks"><h3 title="These are explicit source links, not inferred blockers or workflow rules.">Referenced by (${links.length})</h3>${incomplete}${groups}</section>`;
}
