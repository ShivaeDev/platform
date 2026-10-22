import type { Diagnostic } from "./parse.ts";

const vocabularyFields = new Set(["kind", "status", "owner", "fleet", "delivers", "scope", "urgency"]);
export function invalidField(field: string) {
	const owner = field === "owner" ? "; use codex, claude or marvin" : "";
	const action = vocabularyFields.has(field) ? "run work-board migrate <board dir>." : "kept in the original frontmatter and not interpreted.";
	return `Invalid ${field}${owner}; ${action}`;
}
export function questionFields(fields: Readonly<Record<string, unknown>>, lines: Readonly<Record<string, number>>): Diagnostic[] {
	if (fields.kind !== "question") {
		return [];
	}
	return ["scope", "urgency"]
		.filter((field) => fields[field] === undefined)
		.map((field) => ({ field, line: lines.kind ?? 2, message: `Missing ${field}; run work-board migrate <board dir>.` }));
}
export function vocabularyMessage(document: { readonly file: string; readonly parsed: { readonly diagnostics: readonly Diagnostic[] } }) {
	const problems = document.parsed.diagnostics.filter((problem) => /work-board migrate/u.test(problem.message));
	return problems.length > 0 ? `${document.file}: ${problems.map((problem) => `${problem.field}: ${problem.message}`).join("; ")}` : undefined;
}
