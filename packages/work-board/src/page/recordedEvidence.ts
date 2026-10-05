import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";
import { referenceHtml, sourceHtml, valueHtml } from "./metadataLinks.ts";

export function recordedEvidence(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const records = parsed.fields.evidence ?? [];
	if (records.length === 0) {
		return "";
	}
	return `<h3>Recorded evidence</h3><p>Source claims — not independently verified. A recorded outcome does not establish human acceptance. Work Board does not check recorded revisions against the current workspace.</p><ul>${records.map((item, index) => `<li id="recorded-evidence-${index}" tabindex="-1">${sourceHtml(item.source, file, model)}<dl><dt>Recorded in</dt><dd>${escapeHtml(file)}:${parsed.lines[`evidence.${index}.source`] ?? parsed.lines.evidence ?? 1}</dd><dt>Criterion</dt><dd>${item.criterion ? referenceHtml(item.criterion, item.criterion, model) : "Not recorded"}</dd><dt>Checked revision</dt><dd>${valueHtml(item.checkedRevision)}</dd><dt>Observed time</dt><dd>${valueHtml(item.observedAt)}</dd><dt>Method</dt><dd>${valueHtml(item.method)}</dd><dt>Recorded outcome</dt><dd>${valueHtml(item.outcome)}</dd></dl></li>`).join("")}</ul>`;
}
