import { describe, expect, it } from "vitest";
import { biomeRecommendedFrom } from "#rules/suppressions/biomeRecommended.ts";
import { checkRule } from "#test/inputs.ts";

const PACKAGE = "node_modules/@shivaedev/quality";

const RECOMMENDED = ["a11y/useAltText", "suspicious/noDebugger", "suspicious/noExplicitAny"];

const REASON = "TypeScript reports it already.";

const EXTENDING = { "biome.json": '{ "extends": ["@shivaedev/quality/biome"] }\n' };

function presetTexts(rules: unknown, declarations?: unknown): Readonly<Record<string, string>> {
	return {
		...EXTENDING,
		[`${PACKAGE}/package.json`]: JSON.stringify({ exports: { "./biome": "./biome/preset.json" }, name: "@shivaedev/quality" }),
		[`${PACKAGE}/biome/preset.json`]: JSON.stringify({ linter: { rules } }, null, "\t"),
		...(declarations === undefined ? {} : { [`${PACKAGE}/biome/declarations.json`]: JSON.stringify(declarations) }),
	};
}

async function check(texts: Readonly<Record<string, string>>, recommended: readonly string[] = RECOMMENDED): Promise<readonly string[]> {
	const findings = await checkRule(
		biomeRecommendedFrom(() => Promise.resolve(recommended)),
		undefined,
		{ texts },
	);
	return findings.map((finding) => `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`} ${finding.message}`);
}

const allAtError = {
	a11y: { useAltText: { fix: "none", level: "error" } },
	suspicious: { noDebugger: "error", noExplicitAny: "error" },
};

describe("suppressions/biome-recommended", () => {
	it("passes a preset that sets every recommended rule to error, as a level or with options", async () => {
		expect(await check(presetTexts(allAtError))).toEqual([]);
	});

	it("passes a recommended rule that a group severity sets to error", async () => {
		expect(await check(presetTexts({ ...allAtError, suspicious: "error" }))).toEqual([]);
	});

	it("reports a recommended rule the preset leaves at Biome's default level", async () => {
		expect(await check(presetTexts(allAtError), [...RECOMMENDED, "correctness/noUnusedImports"])).toEqual([
			`${PACKAGE}/biome/preset.json Biome recommends "lint/correctness/noUnusedImports", which the preset leaves at Biome's default level. Set it to "error" in the preset, or declare why not in its declarations.json.`,
		]);
	});

	it("reports each recommended rule the preset sets below error, at its line", async () => {
		const rules = { ...allAtError, suspicious: { noDebugger: "warn", noExplicitAny: { level: "off" } } };
		expect(await check(presetTexts(rules))).toEqual([
			`${PACKAGE}/biome/preset.json:11 Biome recommends "lint/suspicious/noDebugger", which the preset sets to "warn". Set it to "error" in the preset, or declare why not in its declarations.json.`,
			`${PACKAGE}/biome/preset.json:12 Biome recommends "lint/suspicious/noExplicitAny", which the preset sets to "off". Set it to "error" in the preset, or declare why not in its declarations.json.`,
		]);
	});

	it("passes a recommended rule below error that the preset declares, and only that rule", async () => {
		const rules = { ...allAtError, suspicious: { noDebugger: "off", noExplicitAny: "off" } };
		const declarations = [{ includes: ["**"], reason: REASON, rule: "lint/suspicious/noExplicitAny" }];
		expect(await check(presetTexts(rules, declarations))).toEqual([
			`${PACKAGE}/biome/preset.json:11 Biome recommends "lint/suspicious/noDebugger", which the preset sets to "off". Set it to "error" in the preset, or declare why not in its declarations.json.`,
		]);
	});

	it("leaves rules Biome does not recommend to the preset", async () => {
		expect(await check(presetTexts({ ...allAtError, style: { useBlockStatements: "off" } }))).toEqual([]);
	});

	it("leaves a repository whose root Biome config does not extend the preset alone", async () => {
		const unextended = Object.fromEntries(
			Object.entries(presetTexts({ suspicious: { noDebugger: "off" } })).filter(([path]) => path !== "biome.json"),
		);
		expect(await check(unextended)).toEqual([]);
		expect(await check({ ...unextended, "biome.json": '{ "extends": ["./other.json"] }\n' })).toEqual([]);
	});

	it("reports a preset it cannot resolve or declarations it cannot read", async () => {
		expect(await check(EXTENDING)).toEqual([
			'biome.json Cannot resolve "@shivaedev/quality/biome" from node_modules. Install @shivaedev/quality at the repository root.',
		]);
		expect(await check(presetTexts(allAtError, [{ includes: ["**"], reason: " ", rule: "lint/suspicious/noDebugger" }]))).toEqual([
			expect.stringMatching(
				/^node_modules\/@shivaedev\/quality\/biome\/declarations\.json Cannot read the declarations shipped with "@shivaedev\/quality\/biome": /u,
			),
		]);
	});
});
