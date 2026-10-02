import { definePatternRule } from "./pattern-rule.ts";

export const noTodo = definePatternRule({
	id: "comments/no-todo",
	description: "A TODO in the code is never done. Do the work now, or track it where the repository tracks work.",
	patterns: [/\b(?:TODO|FIXME|XXX)\b/, /@todo\b/i],
	message: (match) => `Marks unfinished work: "${match}".`,
});
