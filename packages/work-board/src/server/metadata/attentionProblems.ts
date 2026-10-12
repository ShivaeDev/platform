import type { MetadataDocument } from "./model.ts";
import type { Diagnostic } from "./parse.ts";

export function attentionProblems(document: MetadataDocument): readonly Diagnostic[] {
	const { fields, lines } = document.parsed;
	const requests = fields.attention ?? [];
	return requests.flatMap((request, index) => {
		const line = lines[`attention.${index}.id`] ?? lines.attention ?? 2;
		const problems: Diagnostic[] = [];
		if (!fields.id) {
			problems.push({ field: "attention", line, message: "Attention requests require an explicit item ID; this source remains unclassified." });
		}
		if (requests.filter((other) => other.id === request.id).length > 1) {
			problems.push({ field: "attention", line, message: `Duplicate attention request ID ${request.id}; neither request is selected.` });
		}
		return problems;
	});
}
