import type { Level } from "../../src/config.ts";
import type { Violation } from "../../src/engine/violation.ts";

export const violation = (fields: Partial<Violation> & Pick<Violation, "file" | "rule">): Violation => ({
	level: "error",
	message: `${fields.rule} in ${fields.file}`,
	...fields,
});

export const levels = (entries: Readonly<Record<string, Level>>): ReadonlyMap<string, Level> => new Map(Object.entries(entries));
