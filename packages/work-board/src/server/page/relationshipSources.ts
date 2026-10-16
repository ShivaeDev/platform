import { specificSources } from "#browser/document/sourceGroups.ts";
import { escapeHtml } from "#browser/escapeHtml.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";
import { relationshipLabel } from "#server/metadata/relationshipLabel.ts";
import { referenceFile } from "#server/metadata/sourceLinks.ts";
import { referenceHtml } from "./metadataLinks.ts";
import { sourceListHtml, sourceTitle } from "./sourceListHtml.ts";

export function relationshipSources(parsed: ParsedMetadata, model: MetadataModel): string {
	const relationships = parsed.fields.relationships ?? [];
	if (relationships.length === 0) {
		return "";
	}
	const links = specificSources(
		relationships.flatMap((link) => {
			const href = referenceTarget(link.target, model);
			const file = referenceFile(link.target, model);
			return href && file ? [{ href, kind: relationshipLabel(link.kind), label: link.target, title: sourceTitle(file, model) }] : [];
		}),
	);
	const groups = [...Map.groupBy(links, (link) => link.kind)]
		.map(([kind, sources]) => `<h4>${escapeHtml(kind)}</h4>${sourceListHtml(sources)}`)
		.join("");
	const unresolved = relationships
		.filter((link) => !referenceTarget(link.target, model))
		.map((link) => `<li>${escapeHtml(relationshipLabel(link.kind))}: ${referenceHtml(link.target, link.target, model)}</li>`)
		.join("");
	return `<h3>Relationships</h3>${groups}${unresolved ? `<ul>${unresolved}</ul>` : ""}`;
}
