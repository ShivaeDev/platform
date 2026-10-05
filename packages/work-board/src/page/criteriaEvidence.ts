import { referenceTarget } from "#metadata/links.ts";
import type { MetadataModel } from "#metadata/model.ts";
import type { ParsedMetadata } from "#metadata/parse.ts";
import { escapeHtml } from "./escape.ts";
import { documentReference } from "./metadataLinks.ts";

function evidenceFor(reference: string, model: MetadataModel): string {
	const records = model.documents.flatMap(
		(document) =>
			document.parsed.fields.evidence?.flatMap((evidence, index) =>
				evidence.criterion === reference ? [{ file: document.file, index, line: document.parsed.lines[`evidence.${index}.source`] }] : [],
			) ?? [],
	);
	if (records.length === 0) {
		return "<p>No recorded evidence naming this criterion. Acceptance is not established.</p>";
	}
	return `<p>${records.length} recorded ${records.length === 1 ? "claim" : "claims"}, not verified acceptance:</p><ul>${records.map((record) => `<li><a href="${escapeHtml(documentReference(record.file, model, `#recorded-evidence-${record.index}`))}">${escapeHtml(record.file)}${record.line === undefined ? "" : `:${record.line}`} — open recorded evidence</a></li>`).join("")}</ul>`;
}

export function criteriaEvidence(parsed: ParsedMetadata, model: MetadataModel): string {
	const criteria = parsed.fields.criteria ?? [];
	if (criteria.length === 0) {
		return "";
	}
	return `<h3>Criteria and recorded evidence</h3><ul>${criteria
		.map((criterion) => {
			const unique = criteria.filter((candidate) => candidate.id === criterion.id).length === 1;
			const reference = parsed.fields.id ? `${parsed.fields.id}#${criterion.id}` : "";
			const evidence =
				reference && referenceTarget(reference, model)
					? evidenceFor(reference, model)
					: "<p>Evidence association requires unique item/criterion IDs and a readable workspace. Acceptance is not established.</p>";
			return `<li${unique ? ` id="criterion-${escapeHtml(criterion.id)}" tabindex="-1"` : ""}><b>${escapeHtml(criterion.id)}</b>: ${escapeHtml(criterion.text)}${evidence}</li>`;
		})
		.join("")}</ul>`;
}
