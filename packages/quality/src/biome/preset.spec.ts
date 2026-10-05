import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBiome } from "#biome/run.ts";
import { biomeOverrides } from "#rules/suppressions/biome-overrides.ts";
import { checkRule } from "#test/inputs.ts";
import { linkPackage, packageRoot, removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

const shipped = (path: string): string => readFileSync(join(packageRoot, path), "utf8");

interface Preset {
	readonly linter: { readonly rules: Readonly<Record<string, Readonly<Record<string, unknown>>>> };
}

const preset: Preset = JSON.parse(shipped("biome/preset.json"));

const declaredOff: readonly string[] = JSON.parse(shipped("biome/declarations.json")).map((declaration: { rule: string }) => declaration.rule);

const OFF_FOR_FIXES: readonly string[] = [
	"correctness/noProcessGlobal",
	"correctness/useJsonImportAttributes",
	"nursery/noMisusedPromises",
	"nursery/useExhaustiveSwitchCases",
	"nursery/useSortedClasses",
	"performance/noDelete",
	"style/useConsistentArrayType",
	"style/useConsistentCurlyBraces",
	"suspicious/noEqualsToNull",
	"suspicious/noSkippedTests",
];

const REPORT_ONLY: readonly string[] = [
	"a11y/noAccessKey",
	"a11y/noAriaHiddenOnFocusable",
	"a11y/noAutofocus",
	"a11y/noInteractiveElementToNoninteractiveRole",
	"a11y/noNoninteractiveElementToInteractiveRole",
	"a11y/noNoninteractiveTabindex",
	"a11y/noRedundantRoles",
	"a11y/useValidAriaProps",
	"a11y/useValidAriaRole",
	"complexity/noImportantStyles",
	"correctness/noConstAssign",
	"correctness/noUnusedPrivateClassMembers",
	"correctness/useExhaustiveDependencies",
	"nursery/noFloatingPromises",
	"nursery/useConsistentTestIt",
	"nursery/useRegexpTest",
	"nursery/useUnicodeRegex",
	"style/noNonNullAssertion",
	"style/useAtIndex",
	"style/useNamingConvention",
	"suspicious/noParametersOnlyUsedInRecursion",
];

async function enabledRules(biomeJson: string): Promise<readonly string[]> {
	const root = seedTree([{ content: biomeJson, path: "biome.json" }]);
	linkPackage(root);
	const rage = await runBiome(root, ["rage", "--linter"]);
	return [...rage.stdout.matchAll(/^ {4}([a-z0-9]+\/\w+)$/gimu)].map((match) => match[1] ?? "");
}

function settingOf(rule: string): unknown {
	const [group = "", name = ""] = rule.split("/");
	return preset.linter.rules[group]?.[name];
}

function levelIn(rule: string): unknown {
	const setting = settingOf(rule);
	return typeof setting === "object" && setting !== null && "level" in setting ? setting.level : setting;
}

function fixesOff(): readonly string[] {
	return Object.entries(preset.linter.rules)
		.flatMap(([group, rules]) => Object.keys(rules).map((name) => `${group}/${name}`))
		.filter((rule) => {
			const setting = settingOf(rule);
			return typeof setting === "object" && setting !== null && "fix" in setting && setting.fix === "none";
		});
}

describe("the shipped Biome preset", () => {
	it("sets every rule Biome recommends to error, or declares why it is off", async () => {
		const recommended = await enabledRules('{ "linter": { "rules": { "recommended": true } } }\n');
		expect(recommended.length).toBeGreaterThan(200);
		const loose = recommended.filter((rule) => levelIn(rule) !== "error" && !declaredOff.includes(`lint/${rule}`));
		expect(loose).toEqual([]);
	});

	it("turns off the rules whose fixes changed behavior or did not finish on real code", async () => {
		const enabled = await enabledRules('{ "extends": ["@shivaedev/quality/biome"] }\n');
		expect(enabled).toContain("suspicious/noExplicitAny");
		expect(OFF_FOR_FIXES.filter((rule) => enabled.includes(rule))).toEqual([]);
	});

	it("reports a viewport that disables zoom, and leaves undeclared classes and inline styles to the author", async () => {
		const enabled = await enabledRules('{ "extends": ["@shivaedev/quality/biome"] }\n');
		expect(enabled).toContain("nursery/noNonScalableViewport");
		expect(["nursery/noInlineStyles", "nursery/noUndeclaredClasses"].filter((rule) => enabled.includes(rule))).toEqual([]);
	});

	it("keeps the rules whose fixes can change behavior or remove a decision at error, and turns off only their fixes", () => {
		expect(fixesOff().toSorted((left, right) => left.localeCompare(right))).toEqual(REPORT_ONLY);
		expect(REPORT_ONLY.filter((rule) => levelIn(rule) !== "error")).toEqual([]);
	});

	it("declares every weakening it ships", async () => {
		const texts = {
			"biome.json": '{ "extends": ["@shivaedev/quality/biome"] }\n',
			"node_modules/@shivaedev/quality/biome/declarations.json": shipped("biome/declarations.json"),
			"node_modules/@shivaedev/quality/biome/preset.json": shipped("biome/preset.json"),
			"node_modules/@shivaedev/quality/package.json": shipped("package.json"),
		};
		expect(await checkRule(biomeOverrides, undefined, { files: [], texts })).toEqual([]);
	});
});
