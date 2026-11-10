import { posix } from "node:path";
import { Effect } from "effect";
import { resolvePackage } from "#biome/resolvePackage.ts";
import { PRESET, rootConfig } from "#biome/rootConfig.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { decodeShipped, PRESET_DECLARATIONS } from "#rules/suppressions/biome/declarations.ts";
import { parseJsonc } from "#rules/suppressions/biome/json.ts";

function problem(file: string, message: string): { readonly _tag: "Problem"; readonly findings: readonly Finding[] } {
	return { _tag: "Problem", findings: [{ file, message }] };
}

export const presetConfig = Effect.fn("Biome.presetConfig")(function* (readText: RuleInputs["readText"]) {
	const root = yield* rootConfig(readText);
	if (!root.extendsPreset) {
		return { _tag: "Skipped" } as const;
	}
	const path = yield* resolvePackage(readText, PRESET);
	if (path === undefined) {
		return problem(root.path, `Cannot resolve "${PRESET}" from node_modules. Install @shivaedev/quality at the repository root.`);
	}
	const text = yield* readText(path);
	const parsed = text === undefined ? undefined : parseJsonc(path, text);
	if (parsed?._tag !== "Parsed") {
		return problem(path, `Cannot read the preset "${PRESET}": ${parsed?.reason ?? "the file does not exist"}.`);
	}
	const declarationsPath = posix.join(posix.dirname(path), PRESET_DECLARATIONS);
	const declarationText = yield* readText(declarationsPath);
	const declarations = decodeShipped(declarationText);
	if (declarations._tag === "Invalid") {
		return problem(declarationsPath, `Cannot read the declarations shipped with "${PRESET}": ${declarations.issues.join("; ")}.`);
	}
	return { _tag: "Loaded", declared: declarations.value, json: parsed.json, path } as const;
});
