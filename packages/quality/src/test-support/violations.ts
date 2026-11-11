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
	more: {
		readonly families?: readonly string[];
		readonly halved?: readonly string[];
		readonly skipped?: readonly string[];
		readonly unregistrable?: readonly string[];
	} = {},
): RuleIndex {
	return {
		families: new Set(more.families),
		halved: new Set(more.halved),
		levels: new Map(Object.entries(entries)),
		skipped: new Set(more.skipped),
		unregistrable: new Set(more.unregistrable),
	};
}
