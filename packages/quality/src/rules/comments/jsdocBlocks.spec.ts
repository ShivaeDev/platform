import { noJsdoc } from "#rules/comments/noJsdoc.ts";
import { VITEST_ENVIRONMENT } from "#test/pragmas.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"comments/no-jsdoc reports every JSDoc block at its first line",
	[repositoryHas({ content: "/** Adds. */\nexport const add = 1;\n/**\n * Subtracts.\n */\nexport const sub = 2;\n", path: "src/a.ts" })],
	function* ({ check }) {
		const findings = yield* check(noJsdoc);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{ file: "src/a.ts", line: 1, message: "JSDoc block." },
				{ file: "src/a.ts", line: 3, message: "JSDoc block." },
			]),
		);
	},
);

ruleStory.it(
	"comments/no-jsdoc reports a docblock that mixes prose with an allowed pragma",
	[repositoryHas({ content: `export const a = 1;\n/**\n * Runs in a browser.\n * ${VITEST_ENVIRONMENT} happy-dom\n */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc, { allow: [VITEST_ENVIRONMENT] });

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/a.ts:2"]));
	},
);

ruleStory.it(
	"comments/no-jsdoc reports tool pragmas when the config allows none, as by default",
	[repositoryHas({ content: `/** ${VITEST_ENVIRONMENT} happy-dom */\n/** @jsxImportSource preact */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/a.ts:1", "src/a.ts:2"]));
	},
);

ruleStory.it(
	"comments/no-jsdoc reports a pragma the allow list leaves out and accepts the one it names",
	[repositoryHas({ content: `/** @license MIT */\n/** ${VITEST_ENVIRONMENT} happy-dom */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(noJsdoc, { allow: ["@license"] });

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/a.ts:2"]));
	},
);

ruleStory.it(
	"comments/no-jsdoc accepts a block of pragmas the config allows, one per line",
	[repositoryHas({ content: `/**\n * ${VITEST_ENVIRONMENT} jsdom\n * ${VITEST_ENVIRONMENT}-options {}\n */\n`, path: "src/a.ts" })],
	function* ({ check }) {
		yield* assertThat(yield* check(noJsdoc, { allow: [VITEST_ENVIRONMENT, `${VITEST_ENVIRONMENT}-options`] }), (actual) => actual.toEqual([]));
	},
);

const accepted = [
	["line comments and plain block comments", "// line\n/* block */\n"],
	["an empty /**/ block", "/**/\n"],
	["directives written as docblocks", "export const a = /** @__PURE__ */ make();\n/** @ts-expect-error A wrong type. */\n"],
] as const;

for (const [comments, content] of accepted) {
	ruleStory.it(`comments/no-jsdoc accepts ${comments}`, [repositoryHas({ content, path: "src/a.ts" })], function* ({ check }) {
		yield* assertThat(yield* check(noJsdoc), (actual) => actual.toEqual([]));
	});
}

ruleStory.it("comments/no-jsdoc refuses the misspelled option allows and names it", [], function* ({ optionIssues }) {
	yield* assertThat(yield* optionIssues(noJsdoc, { allows: [] }), (actual, expect) => actual.toEqual([expect.stringContaining("allows")]));
});
