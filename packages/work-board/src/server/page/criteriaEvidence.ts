import { escapeHtml } from "#browser/escapeHtml.ts";
import { referenceTarget } from "#server/metadata/links.ts";
import type { MetadataModel } from "#server/metadata/model.ts";
import type { ParsedMetadata } from "#server/metadata/parse.ts";
import { documentReference } from "./metadataLinks.ts";

function evidenceFor(reference: string, model: MetadataModel): string {
	const records = model.documents.flatMap(
		(document) =>
			document.parsed.fields.evidence?.flatMap((evidence, index) =>
				evidence.criterion === reference ? [{ file: document.file, index, line: document.parsed.lines[`evidence.${index}.source`] }] : [],
			) ?? [],
	);
	if (records.length === 0) {
		return "";
	}
	return `<p>${records.length} recorded ${records.length === 1 ? "claim" : "claims"}, not verified acceptance:</p><ul>${records.map((record) => `<li><a href="${escapeHtml(documentReference(record.file, model, `#recorded-evidence-${record.index}`))}">${escapeHtml(record.file)}${record.line === undefined ? "" : `:${record.line}`} — open recorded evidence</a></li>`).join("")}</ul>`;
}

export function criteriaEvidence(parsed: ParsedMetadata, model: MetadataModel): string {
	const criteria = parsed.fields.criteria ?? [];
	if (criteria.length === 0) {
		return "";
	}
	const associations = criteria.map((criterion) => {
		const reference = parsed.fields.id ? `${parsed.fields.id}#${criterion.id}` : "";
		return reference && referenceTarget(reference, model) ? evidenceFor(reference, model) : undefined;
	});
	const summary = `<p>${associations.filter((evidence) => Boolean(evidence)).length} of ${criteria.length} criteria have recorded evidence</p>`;
	const problem = associations.includes(undefined) ? "<p>Evidence association requires unique item/criterion IDs and a readable workspace.</p>" : "";
	return `<h3>Criteria and recorded evidence</h3>${summary}${problem}<ul>${criteria
		.map((criterion, index) => {
			const unique = criteria.filter((candidate) => candidate.id === criterion.id).length === 1;
			const evidence = associations[index] ?? "";
			return `<li${unique ? ` id="criterion-${escapeHtml(criterion.id)}" tabindex="-1"` : ""}><b>${escapeHtml(criterion.id)}</b>: ${escapeHtml(criterion.text)}${evidence}</li>`;
		})
		.join("")}</ul>`;
}
