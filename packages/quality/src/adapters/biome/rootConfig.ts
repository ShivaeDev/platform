import type { RuleInputs } from "#rule.ts";
import { itemsOf, member, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";

export const PRESET = "@shivaedev/quality/biome/preset.json";

const ROOT_CONFIGS: readonly string[] = ["biome.json", "biome.jsonc"];

interface RootConfig {
	readonly extendsPreset: boolean;
	readonly path: string;
}

export async function rootConfig(readText: RuleInputs["readText"]): Promise<RootConfig> {
	const texts = await Promise.all(ROOT_CONFIGS.map(async (path) => ({ path, text: await readText(path) })));
	const found = texts.find((candidate) => candidate.text !== undefined);
	const parsed = found?.text === undefined ? undefined : parseJsonc(found.path, found.text);
	const extended = parsed?._tag === "Parsed" ? itemsOf(member(parsed.json, "extends")).map(textOf) : [];
	return { extendsPreset: extended.includes(PRESET), path: found?.path ?? "biome.json" };
}
