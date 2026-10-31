import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noInline } from "#rules/suppressions/noInline.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const EXPECT_ERROR = "// @ts-expect-error The types reject it.\n";

for (const [comment, directive] of [
	["// biome-ignore lint/suspicious/noExplicitAny: legacy", "biome-ignore"],
	["// biome-ignore-all lint/style: generated", "biome-ignore-all"],
	["// biome-ignore-start lint/style: generated", "biome-ignore-start"],
	["/* biome-ignore format: aligned table */", "biome-ignore"],
	["// @ts-expect-error The types reject it.", "@ts-expect-error"],
	["// @ts-ignore", "@ts-ignore"],
	["/// @ts-ignore", "@ts-ignore"],
	["// @ts-nocheck", "@ts-nocheck"],
	["/** @ts-expect-error */", "@ts-expect-error"],
	["/*\n * Explained.\n * @ts-ignore\n */", "@ts-ignore"],
	["// eslint-disable-next-line no-console", "eslint-disable-next-line"],
	["/* eslint-disable */", "eslint-disable"],
	["// eslint-disable-line", "eslint-disable-line"],
	['/* eslint no-console: "off" */', "eslint no-console"],
	["// oxlint-disable-next-line no-debugger", "oxlint-disable-next-line"],
	["// deno-lint-ignore no-explicit-any", "deno-lint-ignore"],
	["// deno-lint-ignore-file", "deno-lint-ignore-file"],
	["// tslint:disable-next-line", "tslint:disable"],
	["// prettier-ignore", "prettier-ignore"],
	["// $FlowFixMe[incompatible-type]", "$FlowFixMe"],
	["// @noflow", "@noflow"],
]) {
	ruleStory.it(
		`suppressions/no-inline reports ${JSON.stringify(comment)} as the ${directive} suppression, at the line its comment starts`,
		[repositoryHas({ content: `export const a = 1;\n${comment}\nexport const b = 2;\n`, path: "src/a.ts" })],
		function* ({ check, locations, messages }) {
			yield* check(noInline);

			yield* outcomes([
				["locations", () => locations(), ["src/a.ts:2"]],
				["messages", () => messages(), [`Suppresses a check: "${directive}".`]],
			]);
		},
	);
}

ruleStory.it(
	"suppressions/no-inline reports a suppression that follows code and one inside JSX",
	[
		repositoryHas({
			content: [
				"export const a = f(); // @ts-ignore",
				"export const View = () => (",
				"\t<div>",
				"\t\t{/* biome-ignore lint/a11y/useAltText: decorative */}",
				"\t\t<img />",
				"\t</div>",
				");",
			].join("\n"),
			path: "src/view.tsx",
		}),
	],
	function* ({ check, locations }) {
		yield* check(noInline);

		expect(yield* locations()).toEqual(["src/view.tsx:1", "src/view.tsx:4"]);
	},
);

ruleStory.it(
	"suppressions/no-inline reports a suppression in a declaration file, which the comment rules skip",
	[repositoryHas({ content: "// @ts-nocheck\nexport declare const a: number;\n", path: "src/a.d.ts" })],
	function* ({ check, locations }) {
		yield* check(noInline);

		expect(yield* locations()).toEqual(["src/a.d.ts:1"]);
	},
);

ruleStory.it(
	"suppressions/no-inline reports suppressions in CSS and SCSS stylesheets and ignores one written in a CSS string",
	[
		repositoryHas(
			{
				content:
					'a::after {\n\tcontent: "/* biome-ignore */";\n\t/* biome-ignore lint/complexity/noImportantStyles: overrides a vendor */\n\tcolor: red !important;\n}\n',
				path: "src/a.css",
			},
			{ content: "// stylelint-disable-next-line color-named\na { color: red; background: url(//cdn.example.com/a.png); }\n", path: "src/b.scss" },
		),
	],
	function* ({ check, locations, messages }) {
		yield* check(noInline);

		yield* outcomes([
			["locations", () => locations(), ["src/a.css:3", "src/b.scss:1"]],
			["messages", () => messages(), ['Suppresses a check: "biome-ignore".', 'Suppresses a check: "stylelint-disable-next-line".']],
		]);
	},
);

for (const [what, lines] of [
	[
		"inside strings, template literals and regular expressions",
		['export const a = "// @ts-ignore";', "export const b = `/* biome-ignore lint: x */`;", "export const c = /\\/\\/ eslint-disable/;"],
	],
	[
		"in prose, at the end of a range and in checks that turn something on",
		["// Never add a biome-ignore here.", "// biome-ignore-end", "// eslint-enable", "// @ts-check", "/* eslint is not used in this repository. */"],
	],
	[
		"in coverage hints, bundler annotations and triple-slash references",
		[
			"/* c8 ignore next */",
			"/* v8 ignore next */",
			"/* istanbul ignore next */",
			"export const a = /*#__PURE__*/ make();",
			'/// <reference types="node" />',
		],
	],
] as const) {
	ruleStory.it(
		`suppressions/no-inline ignores directive words ${what}`,
		[repositoryHas({ content: lines.join("\n"), path: "src/a.ts" })],
		function* ({ check }) {
			expect(yield* check(noInline)).toEqual([]);
		},
	);
}

ruleStory.it(
	"suppressions/no-inline reads no line comment in plain CSS, which has none",
	[repositoryHas({ content: "a {\n\tbackground: url(http://example.com/x.png); // biome-ignore lint: x\n}\n", path: "src/a.css" })],
	function* ({ check }) {
		expect(yield* check(noInline)).toEqual([]);
	},
);

ruleStory.it(
	"suppressions/no-inline allows @ts-expect-error only in files named typecheck.test or *.typecheck.test and *.typecheck.spec",
	[
		repositoryHas(
			...[
				"test/api.typecheck.test.ts",
				"test/apiFlow.typecheck.spec.ts",
				"test/typecheck.test.tsx",
				"test/api.typecheck.ts",
				"test/api.test.ts",
				"test/api.spec.ts",
				"test/mytypecheck.test.ts",
				"test/mytypecheck.spec.ts",
			].map((path) => ({ content: EXPECT_ERROR, path })),
		),
	],
	function* ({ check, locations }) {
		yield* check(noInline);

		expect(yield* locations()).toEqual([
			"test/api.spec.ts:1",
			"test/api.test.ts:1",
			"test/api.typecheck.ts:1",
			"test/mytypecheck.spec.ts:1",
			"test/mytypecheck.test.ts:1",
		]);
	},
);

ruleStory.it(
	"suppressions/no-inline reports every other directive in a type test",
	[repositoryHas({ content: "// @ts-expect-error\n// @ts-ignore\n// biome-ignore lint: x\n", path: "test/api.typecheck.test.ts" })],
	function* ({ check, locations, messages }) {
		yield* check(noInline);

		yield* outcomes([
			["locations", () => locations(), ["test/api.typecheck.test.ts:2", "test/api.typecheck.test.ts:3"]],
			["messages", () => messages(), ['Suppresses a check: "@ts-ignore".', 'Suppresses a check: "biome-ignore".']],
		]);
	},
);
