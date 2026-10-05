import { describe, expect, it } from "vitest";
import { maxPerFile } from "#rules/comments/max-per-file.ts";
import { checkRule, issuesOf } from "#test/inputs.ts";
import { VITEST_ENVIRONMENT } from "#test/pragmas.ts";

type Options = Parameters<typeof maxPerFile.configure>[0];

const countOf = async (content: readonly string[], options: Options = { max: 0 }) => {
	const findings = await checkRule(maxPerFile, options, { sources: [{ content: content.join("\n"), path: "src/a.ts" }] });
	return findings[0]?.count ?? 0;
};

describe("comments/max-per-file counts", () => {
	it("a block comment once, however many lines it spans", async () => {
		expect(await countOf(["/*", " * one", " * block", " */"])).toBe(1);
	});

	it("a run of line comments on adjacent lines once", async () => {
		expect(await countOf(["// one", "// run", "\t// still the run", "export const a = 1;"])).toBe(1);
	});

	it("line comments apart, or after code, separately", async () => {
		expect(await countOf(["// one", "", "// two", "export const a = 1; // three", "// four"])).toBe(4);
	});

	it("JSDoc blocks like any other comment", async () => {
		expect(await countOf(["/** one */", "/** two */"])).toBe(2);
	});

	it("no directives", async () => {
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
		expect(await countOf(directives)).toBe(0);
	});

	it("tool pragmas only when the config allows them", async () => {
		const pragmas = [`/** ${VITEST_ENVIRONMENT} happy-dom */`, "", `// ${VITEST_ENVIRONMENT} happy-dom`];
		expect(await countOf(pragmas, { max: 0 })).toBe(2);
		expect(await countOf(pragmas, { allow: [VITEST_ENVIRONMENT], max: 0 })).toBe(0);
	});

	it("pragmas by the configured list", async () => {
		expect(await countOf(["/** @license MIT */", "", `/** ${VITEST_ENVIRONMENT} jsdom */`], { allow: ["@license"], max: 0 })).toBe(1);
	});
});

describe("comments/max-per-file fires", () => {
	it("on a file with more than 2 comments, at the first comment over the limit, counting the comments above it", async () => {
		const content = "// one\nexport const a = 1;\n/* two */\nexport const b = 2;\n// three\n";
		expect(await checkRule(maxPerFile, undefined, { sources: [{ content, path: "src/a.ts" }] })).toEqual([
			{ count: 1, file: "src/a.ts", line: 5, message: "3 comments against a limit of 2.", threshold: 2 },
		]);
	});

	it("at the configured limit", async () => {
		const sources = [{ content: "// one\n", path: "src/a.ts" }];
		expect(await checkRule(maxPerFile, { max: 0 }, { sources })).toEqual([
			{ count: 1, file: "src/a.ts", line: 1, message: "1 comment against a limit of 0.", threshold: 0 },
		]);
	});
});

describe("comments/max-per-file stays quiet", () => {
	it("at exactly the limit", async () => {
		expect(await checkRule(maxPerFile, undefined, { sources: [{ content: "// one\n\n// two\n", path: "src/a.ts" }] })).toEqual([]);
	});
});

describe("comments/max-per-file options", () => {
	it("reject a limit that is not a whole number of at least 0", async () => {
		expect(await issuesOf(maxPerFile, { max: -1 })).toEqual([expect.stringContaining("max")]);
		expect(await issuesOf(maxPerFile, { max: 1.5 })).toEqual([expect.stringContaining("max")]);
	});

	it("reject a misspelled option", async () => {
		expect(await issuesOf(maxPerFile, { maximum: 3 })).toEqual([expect.stringContaining("maximum")]);
	});
});
