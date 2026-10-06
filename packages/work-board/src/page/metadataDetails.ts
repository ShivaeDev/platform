import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { relationshipLabel } from "#metadata/relationshipLabel.ts";
import { attentionDetails } from "./attentionDetails.ts";
import { criteriaEvidence } from "./criteriaEvidence.ts";
import { escapeHtml } from "./escape.ts";
import { referenceHtml, valueHtml } from "./metadataLinks.ts";
import { recordedEvidence } from "./recordedEvidence.ts";

export function metadataDetails(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const fields = parsed.fields;
	const details = [
		fields.handoff
			? `<h3>Agent handoff</h3><p>${referenceHtml(fields.handoff.item, fields.handoff.item, model)} · ${escapeHtml(fields.handoff.recipient)} · ${escapeHtml(fields.handoff.state)}</p><p>Receipt is separate from execution and acceptance.</p><p>${escapeHtml(fields.handoff.by ?? "Attribution not recorded")}${fields.handoff.note ? ` · ${escapeHtml(fields.handoff.note)}` : ""}</p><p>Reviewed SHA-256: <code>${fields.handoff.reviewedRevision}</code></p><p><a href="/_board/handoff?item=${encodeURIComponent(fields.handoff.item)}">Read handoff history and copy its prompt</a></p>`
			: "",
		`<dl><dt>Kind</dt><dd>${valueHtml(fields.kind)}</dd><dt>Status</dt><dd>${valueHtml(fields.status)}</dd><dt>Owner</dt><dd>${valueHtml(fields.owner)}</dd><dt>Next action</dt><dd>${valueHtml(fields.nextAction)}</dd></dl>`,
		fields.relationships?.length
			? `<h3>Relationships</h3><ul>${fields.relationships.map((link) => `<li>${escapeHtml(relationshipLabel(link.kind))}: ${referenceHtml(link.target, link.target, model)}</li>`).join("")}</ul>`
			: "",
		fields.items?.length
			? `<h3>Declared board membership</h3><ul>${fields.items.map((id) => `<li>${referenceHtml(id, id, model)}</li>`).join("")}</ul>`
			: "",

		fields.question
			? `<h3>Reviewed question</h3><p>${referenceHtml(fields.question.item, fields.question.item, model)} / ${escapeHtml(fields.question.request)} · ${escapeHtml(fields.question.reason)}</p><p>Reviewed SHA-256: <code>${fields.question.reviewedRevision}</code>. Registered: ${new Date(fields.question.registeredAt).toISOString()}. Unanswered deadline: ${new Date(fields.question.deadline).toISOString()}.</p>`
			: "",
		fields.response
			? `<h3>Recorded response</h3><p>${referenceHtml(fields.response.question, fields.response.question, model)} · ${escapeHtml(fields.response.author)} · ${escapeHtml(fields.response.type)}</p><p>Reviewed SHA-256: <code>${fields.response.reviewedRevision}</code>. This is authored feedback, not verified acceptance.</p>${fields.response.supersedes ? `<p>Explicitly supersedes ${referenceHtml(fields.response.supersedes, fields.response.supersedes, model)}.</p>` : ""}`
			: "",
		criteriaEvidence(parsed, model),
		attentionDetails(parsed, file, model),
		recordedEvidence(parsed, file, model),
	].join("");
	return details;
}
