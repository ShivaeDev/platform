import { attentionProblems } from "./attentionProblems.ts";
import type { MetadataDocument } from "./model.ts";
import type { Diagnostic } from "./parse.ts";

function referenceProblem(target: string, ids: ReadonlyMap<string, readonly MetadataDocument[]>): string | undefined {
	const [id = "", criterion] = target.split("#");
	const matches = ids.get(id);
	if (!matches?.length) {
		return `Unresolved reference ${target}.`;
	}
	if (matches.length > 1) {
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
function referenceProblems(document: MetadataDocument, ids: ReadonlyMap<string, readonly MetadataDocument[]>): readonly Diagnostic[] {
	const { fields, lines } = document.parsed;
	const references = [
		...(fields.handoff ? [{ field: "handoff", key: "handoff.item", target: fields.handoff.item }] : []),
		...(fields.question ? [{ field: "question", key: "question.item", target: fields.question.item }] : []),
		...(fields.response ? [{ field: "response", key: "response.question", target: fields.response.question }] : []),
		...(fields.response?.supersedes ? [{ field: "response", key: "response.supersedes", target: fields.response.supersedes }] : []),
		...(fields.attention?.flatMap((request, index) =>
			request.unblocks.map((target, targetIndex) => ({ field: "attention", key: `attention.${index}.unblocks.${targetIndex}`, target })),
		) ?? []),
		...(fields.relationships?.map((link, index) => ({ field: "relationships", key: `relationships.${index}.target`, target: link.target })) ?? []),
		...(fields.items?.map((target, index) => ({ field: "items", key: `items.${index}`, target })) ?? []),
		...(fields.evidence?.flatMap((item, index) =>
			item.criterion ? [{ field: "evidence", key: `evidence.${index}.criterion`, target: item.criterion }] : [],
		) ?? []),
	];
	return references.flatMap((reference) => {
		const message = referenceProblem(reference.target, ids);
		return message ? [{ field: reference.field, line: lines[reference.key] ?? lines[reference.field] ?? 2, message }] : [];
	});
}
export function metadataProblems(document: MetadataDocument, ids: ReadonlyMap<string, readonly MetadataDocument[]>, unavailable: readonly string[]) {
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
		problems.push(...referenceProblems(document, ids));
	}
	return problems;
}
