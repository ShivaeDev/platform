import type { Diagnostic, MetadataDocument } from "#integration/metadata.ts";
import { attentionProblems } from "./attentionProblems.ts";
import { referencesOf } from "./referencesOf.ts";

export function referenceProblem(
	target: string,
	ids: ReadonlyMap<string, readonly MetadataDocument[]>,
	settled: ReadonlyMap<string, string> = new Map(),
): string | undefined {
	const [id = "", criterion] = target.split("#");
	const matches = ids.get(id) ?? [];
	const archived = settled.get(id);
	const count = matches.length + (archived && !matches.some((document) => document.file === archived) ? 1 : 0);
	if (count === 0) {
		return `Unresolved reference ${target}.`;
	}
	if (count > 1) {
		return `Ambiguous reference ${target}; the ID is duplicated.`;
	}
	if (criterion && matches[0]?.parsed.fields.criteria?.filter((item) => item.id === criterion).length !== 1) {
		return `Unresolved or duplicated criterion ${target}.`;
	}
	return undefined;
}
function criterionProblems(document: MetadataDocument): readonly Diagnostic[] {
	const criteria = document.parsed.fields.criteria ?? [];
	return criteria.flatMap((criterion, index) =>
		criteria.filter((item) => item.id === criterion.id).length > 1
			? [{ field: "criteria", line: document.parsed.lines[`criteria.${index}`] ?? 2, message: `Duplicate criterion ID ${criterion.id}.` }]
			: [],
	);
}
function referenceProblems(
	document: MetadataDocument,
	ids: ReadonlyMap<string, readonly MetadataDocument[]>,
	settled?: ReadonlyMap<string, string>,
): readonly Diagnostic[] {
	const { lines } = document.parsed;
	const references = referencesOf(document);
	return references.flatMap((reference) => {
		const message = referenceProblem(reference.target, ids, settled);
		return message ? [{ field: reference.field, line: lines[reference.key] ?? lines[reference.field] ?? 2, message }] : [];
	});
}
export function metadataProblems(
	document: MetadataDocument,
	ids: ReadonlyMap<string, readonly MetadataDocument[]>,
	unavailable: readonly string[],
	settled?: ReadonlyMap<string, string>,
) {
	const { parsed } = document;
	const problems = [...parsed.diagnostics, ...criterionProblems(document), ...attentionProblems(document)];
	const matches = parsed.fields.id ? ids.get(parsed.fields.id) : undefined;
	if (matches && matches.length > 1) {
		problems.push({
			field: "id",
			line: parsed.lines.id ?? 2,
			message: `Duplicate ID ${parsed.fields.id}: ${matches.map((item) => item.file).join(", ")}. No source is selected.`,
		});
	}
	if (unavailable.length > 0) {
		if (parsed.raw !== undefined) {
			problems.push({
				line: 1,
				message: `Workspace index incomplete; could not read ${unavailable.join(", ")}. Identity and references cannot be validated completely.`,
			});
		}
	} else {
		problems.push(...referenceProblems(document, ids, settled));
	}
	return problems;
}
