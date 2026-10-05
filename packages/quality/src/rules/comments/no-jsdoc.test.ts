import { describe, expect, it } from "vitest";
import { noJsdoc } from "#rules/comments/no-jsdoc.ts";
import { checkRule, issuesOf } from "#test/inputs.ts";
import { JEST_ENVIRONMENT, VITEST_ENVIRONMENT } from "#test/pragmas.ts";

const jsdoc = async (content: string, options?: { readonly allow?: readonly string[] }) =>
	(await checkRule(noJsdoc, options, { sources: [{ content, path: "src/a.ts" }] })).map((finding) => finding.line);

describe("comments/no-jsdoc fires", () => {
	it("on every JSDoc block, at its first line", async () => {
		const findings = await checkRule(noJsdoc, undefined, {
			sources: [{ content: "/** Adds. */\nexport const add = 1;\n/**\n * Subtracts.\n */\nexport const sub = 2;\n", path: "src/a.ts" }],
		});
		expect(findings).toEqual([
			{ file: "src/a.ts", line: 1, message: "JSDoc block." },
			{ file: "src/a.ts", line: 3, message: "JSDoc block." },
		]);
	});

	it("on a docblock that mixes prose with an allowed pragma", async () => {
		expect(await jsdoc(`/**\n * Runs in a browser.\n * ${VITEST_ENVIRONMENT} happy-dom\n */\n`, { allow: [VITEST_ENVIRONMENT] })).toEqual([1]);
	});

	it("on a tool pragma when the config allows none, as by default", async () => {
		expect(await jsdoc(`/** ${VITEST_ENVIRONMENT} happy-dom */\n/** @jsxImportSource preact */\n`)).toEqual([1, 2]);
	});

	it("on a pragma the configured list leaves out", async () => {
		expect(await jsdoc(`/** @license MIT */\n/** ${VITEST_ENVIRONMENT} happy-dom */\n`, { allow: ["@license"] })).toEqual([2]);
	});
});

describe("comments/no-jsdoc stays quiet", () => {
	it("on line comments, plain block comments and an empty block", async () => {
		expect(await jsdoc("// line\n/* block */\n/**/\n")).toEqual([]);
	});

	it("on directives written as docblocks", async () => {
		expect(await jsdoc("export const a = /** @__PURE__ */ make();\n/** @ts-expect-error A wrong type. */\n")).toEqual([]);
	});

	it("on tool pragmas the config allows", async () => {
		const allow = [VITEST_ENVIRONMENT, `${VITEST_ENVIRONMENT}-options`, JEST_ENVIRONMENT, "@jsxImportSource", "@jsx", "@jsxFrag", "@jsxRuntime"];
		const pragmas = [
			`/** ${VITEST_ENVIRONMENT} happy-dom */`,
			`/**\n * ${VITEST_ENVIRONMENT} jsdom\n * ${VITEST_ENVIRONMENT}-options {}\n */`,
			`/** ${JEST_ENVIRONMENT} node */`,
			"/** @jsxImportSource preact */",
			"/** @jsx h */",
			"/** @jsxFrag Fragment */",
			"/** @jsxRuntime classic */",
		];
		expect(await jsdoc(pragmas.join("\n"), { allow })).toEqual([]);
	});
});

describe("comments/no-jsdoc options", () => {
	it("reject a misspelled option", async () => {
		expect(await issuesOf(noJsdoc, { allows: [] })).toEqual([expect.stringContaining("allows")]);
	});

	it("reject pragmas that are not strings", async () => {
		expect(await issuesOf(noJsdoc, { allow: [1] })).toEqual([expect.stringContaining("allow")]);
	});
});
