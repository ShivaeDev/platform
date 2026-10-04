import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBiome } from "../src/biome/run.ts";
import { biomeOverrides } from "../src/rules/suppressions/biome-overrides.ts";
import { checkRule } from "./support/inputs.ts";
import { linkPackage, packageRoot, removeSeededTrees, seedTree } from "./support/tree.ts";

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

async function enabledRules(biomeJson: string): Promise<readonly string[]> {
	const root = seedTree([{ content: biomeJson, path: "biome.json" }]);
	linkPackage(root);
	const rage = await runBiome(root, ["rage", "--linter"]);
	return [...rage.stdout.matchAll(/^ {4}([a-z0-9]+\/\w+)$/gimu)].map((match) => match[1] ?? "");
}

function levelIn(rule: string): unknown {
	const [group = "", name = ""] = rule.split("/");
	const setting = preset.linter.rules[group]?.[name];
	return typeof setting === "object" && setting !== null && "level" in setting ? setting.level : setting;
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
