import type { MetadataModel } from "#server/metadata/model.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";
import { attentionDetails } from "#server/page/attentionDetails.ts";
import { criteriaEvidence } from "#server/page/criteriaEvidence.ts";
import { referenceHtml, valueHtml } from "#server/page/metadataLinks.ts";
import { recordedEvidence } from "#server/page/recordedEvidence.ts";
import { relationshipSources } from "#server/page/relationshipSources.ts";

export function metadataDetails(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const fields = parsed.fields;
	const details = [
		`<dl><dt>Kind</dt><dd>${valueHtml(fields.kind)}</dd><dt>Status</dt><dd>${valueHtml(fields.status)}</dd><dt>Owner</dt><dd>${valueHtml(fields.owner)}</dd><dt>Next action</dt><dd>${valueHtml(fields.nextAction)}</dd></dl>`,
		relationshipSources(parsed, model),
		fields.items?.length
			? `<h3>Declared board membership</h3><ul>${fields.items.map((id) => `<li>${referenceHtml(id, id, model)}</li>`).join("")}</ul>`
			: "",

		criteriaEvidence(parsed, model),
		fields.attention?.length ? `<details><summary>Request source records</summary>${attentionDetails(parsed, file, model)}</details>` : "",
		recordedEvidence(parsed, file, model),
	].join("");
	return details;
}
