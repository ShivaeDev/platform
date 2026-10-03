import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBiome } from "../src/biome/run.ts";
import { biomeOverrides } from "../src/rules/suppressions/biome-overrides.ts";
import { checkRule } from "./support/inputs.ts";
import { packageRoot, removeSeededTrees, seedTree } from "./support/tree.ts";

afterEach(removeSeededTrees);

const shipped = (path: string): string => readFileSync(join(packageRoot, path), "utf8");

interface Preset {
	readonly linter: { readonly rules: Readonly<Record<string, Readonly<Record<string, unknown>>>> };
}

const preset: Preset = JSON.parse(shipped("biome/preset.json"));

const declaredOff: ReadonlyArray<string> = JSON.parse(shipped("biome/declarations.json")).map((declaration: { rule: string }) => declaration.rule);

function levelIn(rule: string): unknown {
	const [group = "", name = ""] = rule.split("/");
	const setting = preset.linter.rules[group]?.[name];
	return typeof setting === "object" && setting !== null && "level" in setting ? setting.level : setting;
}

describe("the shipped Biome preset", () => {
	it("sets every rule Biome recommends to error, or declares why it is off", async () => {
		const root = seedTree([{ content: '{ "linter": { "rules": { "recommended": true } } }\n', path: "biome.json" }]);
		const rage = await runBiome(root, ["rage", "--linter"]);
		const recommended = [...rage.stdout.matchAll(/^ {4}([a-z0-9]+\/\w+)$/gimu)].map((match) => match[1] ?? "");
		expect(recommended.length).toBeGreaterThan(200);
		const loose = recommended.filter((rule) => levelIn(rule) !== "error" && !declaredOff.includes(`lint/${rule}`));
		expect(loose).toEqual([]);
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
