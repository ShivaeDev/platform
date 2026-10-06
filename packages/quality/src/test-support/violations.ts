import type { Level } from "#config.ts";
import type { RuleIndex, Violation } from "#engine/violation.ts";

export function violation(fields: Partial<Violation> & Pick<Violation, "file" | "rule">): Violation {
	return {
		level: "error",
		message: `${fields.rule} in ${fields.file}`,
		...fields,
	};
}

export function levels(
	entries: Readonly<Record<string, Level>>,
	more: { readonly families?: readonly string[]; readonly unregistrable?: readonly string[] } = {},
): RuleIndex {
	return { families: new Set(more.families), levels: new Map(Object.entries(entries)), unregistrable: new Set(more.unregistrable) };
}
