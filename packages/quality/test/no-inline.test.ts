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

describe("suppressions/no-inline declarations", () => {
	const reason = "Type tests assert the errors the types must raise.";
	const typeTests = { declared: [{ directive: "@ts-expect-error" as const, includes: ["*.typecheck.ts"] as const, reason }] };
	const declaredFindings = async (sources: ReadonlyArray<{ readonly content: string; readonly path: string }>) =>
		(await checkRule(noInline, typeTests, { sources })).map((finding) => `${finding.file}:${finding.line ?? "-"} ${finding.message}`);

	it("allow @ts-expect-error only in the files they include", async () => {
		const expectError = "// @ts-expect-error The types reject it.\n";
		expect(
			await declaredFindings([
				{ content: expectError, path: "test/api.typecheck.ts" },
				{ content: expectError, path: "test/api.test.ts" },
			]),
		).toEqual(['test/api.test.ts:1 Suppresses a check: "@ts-expect-error".']);
	});

	it("never allow another directive in those files", async () => {
		expect(
			await declaredFindings([{ content: "// @ts-expect-error\n// @ts-ignore\n// biome-ignore lint: x\n", path: "test/api.typecheck.ts" }]),
		).toEqual(['test/api.typecheck.ts:2 Suppresses a check: "@ts-ignore".', 'test/api.typecheck.ts:3 Suppresses a check: "biome-ignore".']);
	});

	it("go stale when no directive matches them", async () => {
		expect(await declaredFindings([{ content: "export const a = 1;\n", path: "test/api.typecheck.ts" }])).toEqual([
			'quality.config.ts:- Declares "@ts-expect-error" for "*.typecheck.ts", which matches no directive. Remove the declaration.',
		]);
	});

	it.each([
		["another directive", { declared: [{ directive: "@ts-ignore", includes: ["*.ts"], reason }] }, "directive"],
		["a linter directive", { declared: [{ directive: "biome-ignore", includes: ["*.ts"], reason }] }, "directive"],
		["no includes", { declared: [{ directive: "@ts-expect-error", includes: [], reason }] }, "includes"],
		["a blank reason", { declared: [{ directive: "@ts-expect-error", includes: ["*.ts"], reason: " " }] }, "reason"],
	])("reject %s", async (_, options, field) => {
		expect(await issuesOf(noInline, options)).toEqual([expect.stringContaining(field)]);
	});
});
