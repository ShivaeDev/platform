import type { Level } from "../../src/config.ts";
import type { RuleIndex, Violation } from "../../src/engine/violation.ts";

export const violation = (fields: Partial<Violation> & Pick<Violation, "file" | "rule">): Violation => ({
	level: "error",
	message: `${fields.rule} in ${fields.file}`,
	...fields,
});

export const levels = (
	entries: Readonly<Record<string, Level>>,
	more: { readonly families?: ReadonlyArray<string>; readonly unregistrable?: ReadonlyArray<string> } = {},
): RuleIndex => ({ families: new Set(more.families), levels: new Map(Object.entries(entries)), unregistrable: new Set(more.unregistrable) });
