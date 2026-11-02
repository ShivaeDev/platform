import { expect } from "vitest";
import { noJsdoc } from "#rules/comments/noJsdoc.ts";
import { VITEST_ENVIRONMENT } from "#test/pragmas.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"comments/no-jsdoc reports every JSDoc block at its first line",
	[repositoryHas({ content: "/** Adds. */\nexport const add = 1;\n/**\n * Subtracts.\n */\nexport const sub = 2;\n", path: "src/a.ts" })],
	function* ({ check }) {
		const findings = yield* check(noJsdoc);

		expect(findings).toEqual([
			{ file: "src/a.ts", line: 1, message: "JSDoc block." },
			{ file: "src/a.ts", line: 3, message: "JSDoc block." },
		]);
	},
);

ruleStory.it(
	"comments/no-jsdoc reports a docblock that mixes prose with an allowed pragma",
	[repositoryHas({ content: `export const a = 1;\n/**\n * Runs in a browser.\n * ${VITEST_ENVIRONMENT} happy-dom\n */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc, { allow: [VITEST_ENVIRONMENT] });

		expect(yield* locations()).toEqual(["src/a.ts:2"]);
	},
);

ruleStory.it(
	"comments/no-jsdoc reports tool pragmas when the config allows none, as by default",
	[repositoryHas({ content: `/** ${VITEST_ENVIRONMENT} happy-dom */\n/** @jsxImportSource preact */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc);

		expect(yield* locations()).toEqual(["src/a.ts:1", "src/a.ts:2"]);
	},
);

ruleStory.it(
	"comments/no-jsdoc reports a pragma the allow list leaves out and accepts the one it names",
	[repositoryHas({ content: `/** @license MIT */\n/** ${VITEST_ENVIRONMENT} happy-dom */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc, { allow: ["@license"] });

		expect(yield* locations()).toEqual(["src/a.ts:2"]);
	},
);

ruleStory.it(
	"comments/no-jsdoc accepts a block of pragmas the config allows, one per line",
	[repositoryHas({ content: `/**\n * ${VITEST_ENVIRONMENT} jsdom\n * ${VITEST_ENVIRONMENT}-options {}\n */\n`, path: "src/a.ts" })],
	function* ({ check }) {
		expect(yield* check(noJsdoc, { allow: [VITEST_ENVIRONMENT, `${VITEST_ENVIRONMENT}-options`] })).toEqual([]);
	},
);

const accepted = [
	["line comments and plain block comments", "// line\n/* block */\n"],
	["an empty /**/ block", "/**/\n"],
	["directives written as docblocks", "export const a = /** @__PURE__ */ make();\n/** @ts-expect-error A wrong type. */\n"],
] as const;

for (const [comments, content] of accepted) {
	ruleStory.it(`comments/no-jsdoc accepts ${comments}`, [repositoryHas({ content, path: "src/a.ts" })], function* ({ check }) {
		expect(yield* check(noJsdoc)).toEqual([]);
	});
}

ruleStory.it("comments/no-jsdoc refuses the misspelled option allows and names it", [], function* ({ optionIssues }) {
	expect(yield* optionIssues(noJsdoc, { allows: [] })).toEqual([expect.stringContaining("allows")]);
});
