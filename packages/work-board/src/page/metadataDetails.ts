import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { relationshipLabel } from "#metadata/relationshipLabel.ts";
import { criteriaEvidence } from "./criteriaEvidence.ts";
import { escapeHtml } from "./escape.ts";
import { referenceHtml, valueHtml } from "./metadataLinks.ts";
import { recordedEvidence } from "./recordedEvidence.ts";

export function metadataDetails(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const fields = parsed.fields;
	const details = [
		`<dl><dt>Kind</dt><dd>${valueHtml(fields.kind)}</dd><dt>Status</dt><dd>${valueHtml(fields.status)}</dd><dt>Owner</dt><dd>${valueHtml(fields.owner)}</dd><dt>Next action</dt><dd>${valueHtml(fields.nextAction)}</dd></dl>`,
		fields.relationships?.length
			? `<h3>Relationships</h3><ul>${fields.relationships.map((link) => `<li>${escapeHtml(relationshipLabel(link.kind))}: ${referenceHtml(link.target, link.target, model)}</li>`).join("")}</ul>`
			: "",
		fields.items?.length
			? `<h3>Declared board membership</h3><ul>${fields.items.map((id) => `<li>${referenceHtml(id, id, model)}</li>`).join("")}</ul>`
			: "",

		criteriaEvidence(parsed, model),
		recordedEvidence(parsed, file, model),
	].join("");
	return details;
}
