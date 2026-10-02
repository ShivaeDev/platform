import { describe, expect, it } from "vitest";
import { noInline } from "../src/rules/suppressions/no-inline.ts";
import { checkRule, issuesOf, type Seed } from "./support/inputs.ts";

const found = async (seed: Seed) =>
	(await checkRule(noInline, undefined, seed)).map((finding) => `${finding.file}:${finding.line} ${finding.subject}`);

const inSource = (content: string, path = "src/a.ts") => found({ sources: [{ content, path }] });

describe("suppressions/no-inline fires", () => {
	it.each([
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
	])("on %j", async (comment, directive) => {
		expect(await inSource(`export const a = 1;\n${comment}\nexport const b = 2;\n`)).toEqual([`src/a.ts:2 ${directive}`]);
	});

	it("on every suppression, at the line its comment starts, after code and in JSX", async () => {
		const content = [
			"export const a = f(); // @ts-ignore",
			"export const View = () => (",
			"\t<div>",
			"\t\t{/* biome-ignore lint/a11y/useAltText: decorative */}",
			"\t\t<img />",
			"\t</div>",
			");",
		].join("\n");
		expect(await inSource(content, "src/view.tsx")).toEqual(["src/view.tsx:1 @ts-ignore", "src/view.tsx:4 biome-ignore"]);
	});

	it("in declaration files, which the comment rules skip", async () => {
		expect(await inSource("// @ts-nocheck\nexport declare const a: number;\n", "src/a.d.ts")).toEqual(["src/a.d.ts:1 @ts-nocheck"]);
	});

	it("in stylesheets it reads from the checked files", async () => {
		const css =
			'a::after {\n\tcontent: "/* biome-ignore */";\n\t/* biome-ignore lint/complexity/noImportantStyles: overrides a vendor */\n\tcolor: red !important;\n}\n';
		const scss = "// stylelint-disable-next-line color-named\na { color: red; background: url(//cdn.example.com/a.png); }\n";
		const seed = { files: ["src/a.css", "src/b.scss", "src/c.ts"], texts: { "src/a.css": css, "src/b.scss": scss } };
		expect(await found(seed)).toEqual(["src/a.css:3 biome-ignore", "src/b.scss:1 stylelint-disable-next-line"]);
	});
});

describe("suppressions/no-inline stays quiet", () => {
	it("on directives inside strings, template literals and regular expressions", async () => {
		const content = [
			'export const a = "// @ts-ignore";',
			"export const b = `/* biome-ignore lint: x */`;",
			"export const c = /\\/\\/ eslint-disable/;",
		].join("\n");
		expect(await inSource(content)).toEqual([]);
	});

	it("on prose that mentions a directive, the ends of ranges and checks that turn something on", async () => {
		const content = [
			"// Never add a biome-ignore here.",
			"// biome-ignore-end",
			"// eslint-enable",
			"// @ts-check",
			"/* eslint is not used in this repository. */",
		].join("\n");
		expect(await inSource(content)).toEqual([]);
	});

	it("on coverage hints, bundler annotations and triple-slash references", async () => {
		const content = [
			"/* c8 ignore next */",
			"/* v8 ignore next */",
			"/* istanbul ignore next */",
			"export const a = /*#__PURE__*/ make();",
			'/// <reference types="node" />',
		].join("\n");
		expect(await inSource(content)).toEqual([]);
	});

	it("on line comments in plain CSS, which has none", async () => {
		expect(await found({ files: ["src/a.css"], texts: { "src/a.css": "a { background: url(http://example.com/x.png); }\n" } })).toEqual([]);
	});
});

describe("suppressions/no-inline options", () => {
	it("are refused", async () => {
		expect(await issuesOf(noInline, { allow: ["@ts-expect-error"] })).toEqual(["this rule takes no options"]);
	});
});
