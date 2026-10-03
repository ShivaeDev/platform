import { definePatternRule } from "./pattern-rule.ts";

export const noEnvironmentPragma = definePatternRule({
	id: "comments/no-environment-pragma",
	description:
		"A test file gets its environment from its name, not from a pragma: `*.dom.test.ts` runs in a DOM, every other test in Node. `@shivaedev/quality/vitest` sets up the Vitest projects that read the name.",
	patterns: [/^@(?:vitest|jest)-environment(?:-options)?(?=\s|$)/m],
	message: (match) => `Sets the test environment with "${match}". Name the file *.dom.test.ts or *.dom.test.tsx instead.`,
});
