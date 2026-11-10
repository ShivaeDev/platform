import { Effect } from "effect";
import type { FilesystemFailure } from "#inventory/filesystem.ts";
import type { RuleInputs } from "#rule.ts";
import { itemsOf, member, parseJsonc, textOf } from "#rules/suppressions/biome/json.ts";

export const PRESET = "@shivaedev/quality/biome/preset.json";

const ROOT_CONFIGS: readonly string[] = ["biome.json", "biome.jsonc"];

interface RootConfig {
	readonly extendsPreset: boolean;
	readonly path: string;
}

export const rootConfig = Effect.fn("Biome.rootConfig")(function* (
	readText: RuleInputs["readText"],
): Effect.fn.Return<RootConfig, FilesystemFailure> {
	const texts = yield* Effect.forEach(ROOT_CONFIGS, (path) => Effect.map(readText(path), (text) => ({ path, text })), { concurrency: "unbounded" });
	const found = texts.find((candidate) => candidate.text !== undefined);
	const parsed = found?.text === undefined ? undefined : parseJsonc(found.path, found.text);
	const extended = parsed?._tag === "Parsed" ? itemsOf(member(parsed.json, "extends")).map(textOf) : [];
	return { extendsPreset: extended.includes(PRESET), path: found?.path ?? "biome.json" };
});
