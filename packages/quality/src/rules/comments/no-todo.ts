import { definePatternRule } from "./pattern-rule.ts";

export const noTodo = definePatternRule({
	description: "A TODO in the code is never done. Do the work now, or track it where the repository tracks work.",
	id: "comments/no-todo",
	message: (match) => `Marks unfinished work: "${match}".`,
	patterns: [/\b(?:TODO|FIXME|XXX)\b/u, /@todo\b/iu],
});
