import { referenceTarget } from "#metadata/links.ts";
import type { MetadataDocument, MetadataModel } from "#metadata/model.ts";
import { escapeHtml } from "#page/escape.ts";
import { referenceHtml, sourceHtml, valueHtml } from "#page/metadataLinks.ts";

function criterionRow(reference: string, text: string, result: MetadataDocument, model: MetadataModel): string {
	if (!referenceTarget(reference, model)) {
		return `<li>${escapeHtml(text)} — criterion identity is ambiguous; evidence association unavailable.</li>`;
	}
	const claims = result.parsed.fields.evidence?.filter((claim) => claim.criterion === reference) ?? [];
	const evidence =
		claims.length > 0
			? `<p>${claims.length} recorded claim(s) in this result; not verified acceptance.</p><ul>${claims.map((claim) => `<li>${sourceHtml(claim.source, result.file, model)}<dl><dt>Checked Git revision (reported)</dt><dd>${valueHtml(claim.checkedRevision)}</dd><dt>Method</dt><dd>${valueHtml(claim.method)}</dd><dt>Outcome (reported)</dt><dd>${valueHtml(claim.outcome)}</dd><dt>Observed time</dt><dd>${valueHtml(claim.observedAt)}</dd></dl></li>`).join("")}</ul>`
			: "<p>No recorded evidence in this result naming this criterion. Acceptance is not established.</p>";
	return `<li>${referenceHtml(text, reference, model)}${evidence}</li>`;
}
function targetRow(target: string, result: MetadataDocument, model: MetadataModel): string {
	const [id, criterion] = target.split("#");
	const document = model.ids.get(id ?? "")?.[0];
	if (!(document && referenceTarget(target, model))) {
		return `<li>${referenceHtml(target, target, model)} — criteria unavailable.</li>`;
	}
	const criteria = (document.parsed.fields.criteria ?? []).filter((item) => !criterion || item.id === criterion);
	const rows =
		criteria.length > 0
			? `<ul>${criteria.map((item) => criterionRow(`${id}#${item.id}`, item.text, result, model)).join("")}</ul>`
			: "<p>No criteria declared in this source.</p>";
	return `<li>${referenceHtml(target, target, model)} · source status: ${valueHtml(document.parsed.fields.status)}${rows}</li>`;
}
export function resultCriteria(result: MetadataDocument, model: MetadataModel): string {
	const targets = new Set(result.parsed.fields.relationships?.map((link) => link.target));
	if (result.parsed.fields.id) {
		targets.add(result.parsed.fields.id);
	}
	const rows = [...targets].map((target) => targetRow(target, result, model));
	return `<section id="result-criteria"><h2>Criteria and this result’s claims</h2><p>Only explicit relationships and criterion references are associated. Missing provenance stays missing. Git revisions are authored records; Work Board does not compare them with the current checkout. Evidence freshness is unknown.</p>${rows.length > 0 ? `<ul>${rows.join("")}</ul>` : "<p>No explicitly linked work or criteria.</p>"}<p>${escapeHtml(result.file)} does not change the linked work’s status.</p></section>`;
}
