import { escapeHtml } from "#browser/escapeHtml.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";
import { referenceHtml } from "#server/page/metadataLinks.ts";

export function metadataRecords(parsed: ParsedMetadata, model: MetadataModel): string {
	const fields = parsed.fields;
	return [
		fields.handoff
			? `<h3>Agent handoff</h3><p>${referenceHtml(fields.handoff.item, fields.handoff.item, model)} · ${escapeHtml(fields.handoff.recipient)} · ${escapeHtml(fields.handoff.state)}</p><p>Receipt is separate from execution and acceptance.</p><p>${escapeHtml(fields.handoff.by ?? "")}${fields.handoff.note ? ` · ${escapeHtml(fields.handoff.note)}` : ""}</p><p>Reviewed SHA-256: <code>${fields.handoff.reviewedRevision}</code></p><p><a href="/_board/handoff?item=${encodeURIComponent(fields.handoff.item)}">Read handoff history and copy its prompt</a></p>`
			: "",
		fields.question
			? `<h3>Reviewed question</h3><p>${referenceHtml(fields.question.item, fields.question.item, model)} / ${escapeHtml(fields.question.request)} · ${escapeHtml(fields.question.reason)}</p><p>Reviewed SHA-256: <code>${fields.question.reviewedRevision}</code>. Registered: ${new Date(fields.question.registeredAt).toISOString()}. Unanswered deadline: ${new Date(fields.question.deadline).toISOString()}.</p>`
			: "",
		fields.response
			? `<h3>Recorded response</h3><p>${referenceHtml(fields.response.question, fields.response.question, model)} · ${escapeHtml(fields.response.author)} · ${escapeHtml(fields.response.type)}</p><p>Reviewed SHA-256: <code>${fields.response.reviewedRevision}</code>. This is authored feedback, not verified acceptance.</p>${fields.response.supersedes ? `<p>Explicitly supersedes ${referenceHtml(fields.response.supersedes, fields.response.supersedes, model)}.</p>` : ""}`
			: "",
		fields.requestReceipt
			? `<h3>Managed request receipt</h3><p>${referenceHtml(fields.requestReceipt.question, fields.requestReceipt.question, model)} · ${fields.requestReceipt.disposition}</p><p>Reviewed SHA-256: <code>${fields.requestReceipt.reviewedRevision}</code>. This acknowledges request handling, not execution, acceptance or delivery authority.</p>${fields.requestReceipt.response ? `<p>Applied response: ${referenceHtml(fields.requestReceipt.response, fields.requestReceipt.response, model)}</p>` : ""}`
			: "",
	].join("");
}
