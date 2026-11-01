import { expect } from "vitest";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const named = [
	["src/liveQueryWindow.ts", "export const liveQueryWindow = 30;\n"],
	["src/timeout.ts", "export const timeout = 30;\n"],
	["src/liveQueryWindow.ts", "export const liveQueryWindow = { milliseconds: 30 };\n"],
	["src/liveQueryWindow.ts", "const window = 30;\nexport { window as liveQueryWindow };\n"],
	["src/queries/window.ts", "export const queryWindow = 30;\n"],
] as const;

for (const [path, content] of named) {
	ruleStory.it(`files/named-after-export accepts ${path} holding ${content.trim()}`, [repositoryHas({ content, path })], function* ({ check }) {
		expect(yield* check(namedAfterExport)).toEqual([]);
	});
}

const misnamed = [
	["src/window.ts", "export const liveQueryWindow = 30;\n", '"window" does not name its export liveQueryWindow.'],
	["src/maxItems.ts", "export const MAX_ITEMS = 10;\n", '"maxItems" does not name its export MAX_ITEMS.'],
	["src/queries/queryWindow.ts", "export const queryWindow = 30;\n", '"queryWindow" repeats its folder "queries".'],
	[
		"src/Limits.ts",
		"export const MAX_ITEMS = 10;\nexport const MAX_DEPTH = 4;\n",
		'"Limits" exports several things, so it is a topic file named in camelCase',
	],
	["src/Limits.ts", "export const MAX_ITEMS = 10, MAX_DEPTH = 4;\n", '"Limits" exports several things, so it is a topic file named in camelCase'],
] as const;

for (const [path, content, reason] of misnamed) {
	ruleStory.it(`files/named-after-export refuses ${path}: ${reason}`, [repositoryHas({ content, path })], function* ({ check, messages }) {
		yield* check(namedAfterExport);

		expect(yield* messages()).toEqual([expect.stringContaining(reason)]);
	});
}
