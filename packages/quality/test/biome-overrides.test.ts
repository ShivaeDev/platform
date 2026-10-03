import { describe, expect, it } from "vitest";
import { biomeOverrides } from "../src/rules/suppressions/biome-overrides.ts";
import { checkRule, issuesOf } from "./support/inputs.ts";

type Options = Parameters<typeof biomeOverrides.configure>[0];

const reason = "Vitest reads the fixture's first parameter and needs an object pattern.";

const check = async (texts: Readonly<Record<string, string>>, options?: Options, files?: ReadonlyArray<string>) =>
	(await checkRule(biomeOverrides, options, { files: files ?? [], texts })).map(
		(finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`,
	);

const weakened = async (config: unknown) =>
	(await check({ "biome.json": JSON.stringify(config, null, "\t") })).map((line) => /"([^"]+)"/.exec(line)?.[1]);

const override = (includes: ReadonlyArray<string>, linter: unknown) => ({ overrides: [{ includes, linter }] });

describe("suppressions/biome-overrides finds", () => {
	it("a rule turned off at the top level, at its line, scoped to the whole repository", async () => {
		const config = '{\n\t"linter": {\n\t\t"rules": {\n\t\t\t"complexity": { "useLiteralKeys": "off" }\n\t\t}\n\t}\n}\n';
		expect(await check({ "biome.json": config })).toEqual(['biome.json:4 Weakens "lint/complexity/useLiteralKeys" for "**" without a declaration.']);
	});

	it("a rule turned off or down in an override, scoped to its includes", async () => {
		const config = override(["src/a.ts", "src/b.ts"], { rules: { suspicious: { noExplicitAny: "warn", noThenProperty: { level: "info" } } } });
		expect(await check({ "biome.json": JSON.stringify(config) })).toEqual([
			'biome.json:1 Weakens "lint/suspicious/noExplicitAny" for "src/a.ts", "src/b.ts" without a declaration.',
			'biome.json:1 Weakens "lint/suspicious/noThenProperty" for "src/a.ts", "src/b.ts" without a declaration.',
		]);
	});

	it.each([
		["the linter", { linter: { enabled: false } }, "lint"],
		["the recommended rules", { linter: { rules: { recommended: false } } }, "lint/recommended"],
		["the recommended preset", { linter: { rules: { preset: "none" } } }, "lint/recommended"],
		["a group", { linter: { rules: { style: "off" } } }, "lint/style"],
		["a group's recommended rules", { linter: { rules: { a11y: { recommended: false } } } }, "lint/a11y"],
		["a domain", { linter: { domains: { react: "none" } } }, "lint/domains/react"],
		["the assist", { assist: { enabled: false } }, "assist"],
		["the recommended actions", { assist: { actions: { recommended: false } } }, "assist/recommended"],
		["an assist action", { assist: { actions: { source: { useSortedKeys: "off" } } } }, "assist/source/useSortedKeys"],
		["an assist action with options", { assist: { actions: { source: { organizeImports: { level: "off" } } } } }, "assist/source/organizeImports"],
		["the formatter", { formatter: { enabled: false } }, "format"],
		["a language's linter", { css: { linter: { enabled: false } } }, "css/lint"],
		["a language's formatter", { json: { formatter: { enabled: false } } }, "json/format"],
		["a language's assist", { javascript: { assist: { enabled: false } } }, "javascript/assist"],
	])("%s switched off", async (_, config, rule) => {
		expect(await weakened(config)).toEqual([rule]);
		expect(await weakened({ overrides: [{ includes: ["src/**"], ...config }] })).toEqual([rule]);
	});

	it.each([
		["excluded files", { files: { includes: ["**", "!**/dist", "!!vendor"] } }, 'Weakens "files/includes" for "**", "!**/dist", "!!vendor"'],
		["files kept from the linter", { linter: { includes: ["**", "!scripts/**"] } }, 'Weakens "lint/includes" for "**", "!scripts/**"'],
		["a linter narrowed to some files", { linter: { includes: ["src/**"] } }, 'Weakens "lint/includes" for "src/**"'],
		["files kept from the formatter", { formatter: { includes: ["**", "!*.md"] } }, 'Weakens "format/includes" for "**", "!*.md"'],
	])("%s, as the whole list", async (_, config, message) => {
		expect(await check({ "biome.json": JSON.stringify(config) })).toEqual([`biome.json:1 ${message} without a declaration.`]);
	});

	it("no narrowing in a list that keeps every file", async () => {
		expect(await weakened({ files: { includes: ["**"] }, linter: { includes: ["**"] } })).toEqual([]);
	});

	it("no weakening in rules raised, enabled or configured", async () => {
		const config = {
			formatter: { indentStyle: "tab", lineWidth: 150 },
			linter: { domains: { react: "all" }, rules: { complexity: { noExcessiveCognitiveComplexity: "error" }, preset: "recommended", style: "on" } },
			assist: { actions: { source: { useSortedKeys: "on" } } },
		};
		expect(await weakened(config)).toEqual([]);
	});

	it("nested configs, scoped below their folder, and the local files a config extends", async () => {
		const texts = {
			"biome.json": '{ "extends": ["./biome.base.json"] }',
			"biome.base.json": JSON.stringify(override(["**/*.test.ts"], { rules: { style: { noNonNullAssertion: "off" } } })),
			"packages/web/biome.jsonc":
				'// web\n{ "extends": "//", "linter": { "rules": { "a11y": "off" } }, "overrides": [{ "includes": ["!src/**"], "formatter": { "enabled": false } }] }',
		};
		expect(await check(texts, undefined, ["packages/web/biome.jsonc", "packages/web/src/a.ts"])).toEqual([
			'biome.base.json:1 Weakens "lint/style/noNonNullAssertion" for "**/*.test.ts" without a declaration.',
			'packages/web/biome.jsonc:2 Weakens "lint/a11y" for "packages/web/**" without a declaration.',
			'packages/web/biome.jsonc:2 Weakens "format" for "!packages/web/src/**" without a declaration.',
		]);
	});

	it("a config it cannot read", async () => {
		expect(await check({ "biome.json": '{ "linter": ' })).toEqual(["biome.json Cannot read this Biome config: Expression expected."]);
		expect(await check({ "biome.json": '{ "extends": ["./missing.json"] }' })).toEqual([
			"missing.json Cannot read this Biome config: the file does not exist.",
		]);
	});
});

describe("suppressions/biome-overrides declarations", () => {
	const config = JSON.stringify(override(["src/vitest.ts", "src/fixtures.ts"], { rules: { correctness: { noEmptyPattern: "off" } } }));
	const declared = (includes: readonly [string, ...string[]], rule = "lint/correctness/noEmptyPattern") => ({
		declared: [{ includes, reason, rule }],
	});

	it("cover a weakening with the same rule and includes, in any order", async () => {
		expect(await check({ "biome.json": config }, declared(["src/fixtures.ts", "src/vitest.ts"]))).toEqual([]);
	});

	it("leave a weakening uncovered when the scope differs, and report the declaration that matches nothing", async () => {
		expect(await check({ "biome.json": config }, declared(["src/vitest.ts"]))).toEqual([
			'biome.json:1 Weakens "lint/correctness/noEmptyPattern" for "src/vitest.ts", "src/fixtures.ts" without a declaration.',
			'biome.json Declares "lint/correctness/noEmptyPattern" for "src/vitest.ts", which no Biome config weakens. Remove the declaration.',
		]);
	});

	it("go stale when the setting is gone, even without a Biome config", async () => {
		expect(await check({}, declared(["src/vitest.ts"], "lint/suspicious/noExplicitAny"))).toEqual([
			'biome.json Declares "lint/suspicious/noExplicitAny" for "src/vitest.ts", which no Biome config weakens. Remove the declaration.',
		]);
	});

	it.each([
		["a blank reason", { declared: [{ includes: ["src/a.ts"], reason: " ", rule: "lint/style/noNonNullAssertion" }] }, "reason"],
		["no includes", { declared: [{ includes: [], reason, rule: "lint/style/noNonNullAssertion" }] }, "includes"],
		["no rule", { declared: [{ includes: ["src/a.ts"], reason, rule: "" }] }, "rule"],
		["an unknown field", { declared: [{ file: "src/a.ts", includes: ["src/a.ts"], reason, rule: "lint/style/noNonNullAssertion" }] }, "file"],
	])("reject %s", async (_, options, field) => {
		expect(await issuesOf(biomeOverrides, options)).toEqual([expect.stringContaining(field)]);
	});
});
