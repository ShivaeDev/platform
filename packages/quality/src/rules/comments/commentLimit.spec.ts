import { expect } from "vitest";
import { maxPerFile } from "#rules/comments/maxPerFile.ts";
import { VITEST_ENVIRONMENT } from "#test/pragmas.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const counted = [
	["a block comment once, however many lines it spans", ["/*", " * one", " * block", " */"], "1 comment"],
	["a run of line comments on adjacent lines once", ["// one", "// run", "\t// still the run", "export const a = 1;"], "1 comment"],
	["line comments apart from each other or after code separately", ["// one", "", "// two", "export const a = 1; // three", "// four"], "4 comments"],
	["JSDoc blocks like any other comment", ["/** one */", "/** two */"], "2 comments"],
	[
		"a tool pragma when the config allows none, as by default",
		[`/** ${VITEST_ENVIRONMENT} happy-dom */`, "", `// ${VITEST_ENVIRONMENT} happy-dom`],
		"2 comments",
	],
] as const;

for (const [counts, lines, count] of counted) {
	ruleStory.it(
		`comments/max-per-file counts ${counts}`,
		[repositoryHas({ content: lines.join("\n"), path: "src/a.ts" })],
		function* ({ check, messages }) {
			yield* check(maxPerFile, { max: 0 });

			expect(yield* messages()).toEqual([`${count} against a limit of 0.`]);
		},
	);
}

ruleStory.it(
	"comments/max-per-file counts a pragma the allow list leaves out and not the one it names",
	[repositoryHas({ content: `/** @license MIT */\n\n/** ${VITEST_ENVIRONMENT} jsdom */\n`, path: "src/a.ts" })],
	function* ({ check, locations }) {
		yield* check(maxPerFile, { allow: ["@license"], max: 0 });

		expect(yield* locations()).toEqual(["src/a.ts:3"]);
	},
);

const directives = [
	'/// <reference types="node" />',
	"// @ts-expect-error The next line proves a type error.",
	"// biome-ignore lint/suspicious/noExplicitAny: a reason",
	"// eslint-disable-next-line",
	"// eslint-enable",
	"// prettier-ignore",
	"// oxlint-disable-next-line no-debugger",
	"/* stylelint-disable */",
	"// deno-lint-ignore no-explicit-any",
	"// $FlowFixMe",
	"export const a = /*#__PURE__*/ make();",
	"export const b = /* @__PURE__ */ make();",
	"/*#__NO_SIDE_EFFECTS__*/",
	"/* c8 ignore next */",
	"/* v8 ignore next */",
	"/* istanbul ignore next */",
];

for (const directive of directives) {
	ruleStory.it(
		`comments/max-per-file does not count the directive ${directive}`,
		[repositoryHas({ content: `${directive}\n`, path: "src/a.ts" })],
		function* ({ check }) {
			expect(yield* check(maxPerFile, { max: 0 })).toEqual([]);
		},
	);
}

ruleStory.it(
	"comments/max-per-file reports a third comment at its line, one over the default limit of 2",
	[repositoryHas({ content: "// one\nexport const a = 1;\n/* two */\nexport const b = 2;\n// three\n", path: "src/a.ts" })],
	function* ({ check }) {
		const findings = yield* check(maxPerFile);

		expect(findings).toEqual([{ count: 1, file: "src/a.ts", line: 5, message: "3 comments against a limit of 2.", threshold: 2 }]);
	},
);

ruleStory.it(
	"comments/max-per-file accepts two comments at the default limit of 2",
	[repositoryHas({ content: "// one\n\n// two\n", path: "src/a.ts" })],
	function* ({ check }) {
		expect(yield* check(maxPerFile)).toEqual([]);
	},
);

const refused = [
	["a negative max", { max: -1 }, "max"],
	["a fractional max", { max: 1.5 }, "max"],
	["a max above the shared limit of 2", { max: 3 }, "max"],
	["the misspelled option maximum", { maximum: 3 }, "maximum"],
] as const;

for (const [options, given, named] of refused) {
	ruleStory.it(`comments/max-per-file refuses ${options} and names it`, [], function* ({ optionIssues }) {
		expect(yield* optionIssues<unknown>(maxPerFile, given)).toEqual([expect.stringContaining(named)]);
	});
}
