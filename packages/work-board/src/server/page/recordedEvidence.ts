import { escapeHtml } from "#browser/escapeHtml.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";
import { referenceHtml, sourceHtml, valueHtml } from "./metadataLinks.ts";

export function recordedEvidence(parsed: ParsedMetadata, file: string, model: MetadataModel): string {
	const records = parsed.fields.evidence ?? [];
	if (records.length === 0) {
		return "";
	}
	return `<h3 title="Source claims are not independently verified. A recorded outcome does not establish human acceptance. Work Board does not check recorded revisions against the current workspace.">Recorded evidence</h3><ul>${records.map((item, index) => `<li id="recorded-evidence-${index}" tabindex="-1">${sourceHtml(item.source, file, model)}<dl><dt>Recorded in</dt><dd>${escapeHtml(file)}:${parsed.lines[`evidence.${index}.source`] ?? parsed.lines.evidence ?? 1}</dd><dt>Criterion</dt><dd>${item.criterion ? referenceHtml(item.criterion, item.criterion, model) : ""}</dd><dt>Checked revision</dt><dd>${valueHtml(item.checkedRevision)}</dd><dt>Observed time</dt><dd>${valueHtml(item.observedAt)}</dd><dt>Method</dt><dd>${valueHtml(item.method)}</dd><dt>Recorded outcome</dt><dd>${valueHtml(item.outcome)}</dd></dl></li>`).join("")}</ul>`;
}
