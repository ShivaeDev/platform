import { fileUrl } from "#files/url.ts";
import { referenceTarget } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";

function reference(label: string, target: string, model: MetadataModel): string {
	const href = referenceTarget(target, model);
	return href
		? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
		: `<span>${escapeHtml(label)} (unresolved, ambiguous, or unavailable)</span>`;
}
function sourceLink(source: string, file: string): string {
	try {
		const url = new URL(source, `http://work-board.local${fileUrl(file)}`);
		if (!["http:", "https:"].includes(url.protocol)) {
			return escapeHtml(source);
		}
		const href = url.origin === "http://work-board.local" ? url.pathname + url.search + url.hash : url.href;
		return `<a href="${escapeHtml(href)}" rel="noreferrer">${escapeHtml(source)}</a>`;
	} catch {
		return escapeHtml(source);
	}
}
function value(text: string | undefined): string {
	return escapeHtml(text ?? "Not recorded");
}

export function metadataDetails(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const fields = parsed.fields;
	const criteria = fields.criteria ?? [];
	const details = [
		`<dl><dt>Kind</dt><dd>${value(fields.kind)}</dd><dt>Status</dt><dd>${value(fields.status)}</dd><dt>Owner</dt><dd>${value(fields.owner)}</dd><dt>Next action</dt><dd>${value(fields.nextAction)}</dd></dl>`,
		fields.relationships?.length
			? `<h3>Relationships</h3><ul>${fields.relationships.map((link) => `<li>${escapeHtml(link.kind)}: ${reference(link.target, link.target, model)}</li>`).join("")}</ul>`
			: "",
		fields.items?.length
			? `<h3>Declared board membership</h3><ul>${fields.items.map((id) => `<li>${reference(id, id, model)}</li>`).join("")}</ul>`
			: "",

		criteria.length > 0
			? `<h3>Criteria</h3><ul>${criteria.map((criterion) => `<li${criteria.filter((item) => item.id === criterion.id).length === 1 ? ` id="criterion-${escapeHtml(criterion.id)}" tabindex="-1"` : ""}><b>${escapeHtml(criterion.id)}</b>: ${escapeHtml(criterion.text)}</li>`).join("")}</ul>`
			: "",
		fields.evidence?.length
			? `<h3>Recorded evidence</h3><p>Source claims — not independently verified. A recorded outcome does not establish human acceptance.</p><ul>${fields.evidence.map((item) => `<li>${sourceLink(item.source, file)}<dl><dt>Criterion</dt><dd>${item.criterion ? reference(item.criterion, item.criterion, model) : "Not recorded"}</dd><dt>Checked revision</dt><dd>${value(item.checkedRevision)}</dd><dt>Observed time</dt><dd>${value(item.observedAt)}</dd><dt>Method</dt><dd>${value(item.method)}</dd><dt>Recorded outcome</dt><dd>${value(item.outcome)}</dd></dl></li>`).join("")}</ul>`
			: "",
	].join("");
	return details;
}
