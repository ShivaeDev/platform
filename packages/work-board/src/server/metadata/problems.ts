import { workPhase } from "#browser/views/workStatus.ts";
import { attentionProblems } from "./attentionProblems.ts";
import type { MetadataDocument } from "./model.ts";
import type { Diagnostic } from "./parse.ts";
import { referencesOf } from "./referencesOf.ts";

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
function statusProblems({ parsed }: MetadataDocument): readonly Diagnostic[] {
	const { kind, relationships, status } = parsed.fields;
	const work = kind === "task" || relationships?.some((link) => link.kind === "implements");
	return work && status !== undefined && workPhase(status) === undefined
		? [
				{
					field: "status",
					line: parsed.lines.status ?? 2,
					message: `Unknown status ${status}. Now leaves this work out and goal pages count it as planned.`,
				},
			]
		: [];
}
function referenceProblems(document: MetadataDocument, ids: ReadonlyMap<string, readonly MetadataDocument[]>): readonly Diagnostic[] {
	const { lines } = document.parsed;
	const references = referencesOf(document);
	return references.flatMap((reference) => {
		const message = referenceProblem(reference.target, ids);
		return message ? [{ field: reference.field, line: lines[reference.key] ?? lines[reference.field] ?? 2, message }] : [];
	});
}
export function metadataProblems(document: MetadataDocument, ids: ReadonlyMap<string, readonly MetadataDocument[]>, unavailable: readonly string[]) {
	const { parsed } = document;
	const problems = [...parsed.diagnostics, ...criterionProblems(document), ...statusProblems(document), ...attentionProblems(document)];
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
