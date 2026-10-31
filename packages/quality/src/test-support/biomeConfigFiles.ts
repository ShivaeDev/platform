import { Effect } from "effect";
import type { Rule } from "#rule.ts";
import { biomeRecommendedFrom } from "#rules/suppressions/biomeRecommended.ts";
import type { SeedFile } from "./tree.ts";

export const ACME = "node_modules/@acme/lint";

const QUALITY = "node_modules/@shivaedev/quality";

export const EXTENDS_QUALITY: SeedFile = { content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" };

export function biomeJson(config: unknown, path = "biome.json"): SeedFile {
	return { content: JSON.stringify(config), path };
}

export function off(group: string, rule: string) {
	return { linter: { rules: { [group]: { [rule]: "off" } } } };
}

export function weak(rule: string): string {
	return JSON.stringify(off("suspicious", rule));
}

export function extending(...entries: readonly string[]): SeedFile {
	return biomeJson({ extends: entries });
}

export function acmePackage(manifest: object, files: Readonly<Record<string, string>> = {}): readonly SeedFile[] {
	return [
		{ content: JSON.stringify({ name: "@acme/lint", ...manifest }), path: `${ACME}/package.json` },
		...Object.entries(files).map(([path, content]) => ({ content, path: `${ACME}/${path}` })),
	];
}

export function acmePreset(preset: unknown, declarations?: unknown): readonly SeedFile[] {
	return acmePackage(
		{ exports: { "./biome": { biome: "./biome/biome.json", default: "./biome/other.json" } } },
		{
			"biome/biome.json": JSON.stringify(preset),
			...(declarations === undefined ? {} : { "biome/declarations.json": JSON.stringify(declarations) }),
		},
	);
}

export function consumer(config: object, path = "biome.json"): SeedFile {
	return { content: JSON.stringify({ extends: ["@acme/lint/biome"], ...config }, null, "\t"), path };
}

export function qualityPreset(rules: unknown, declarations?: unknown): readonly SeedFile[] {
	return [
		{
			content: JSON.stringify({ exports: { "./biome/preset.json": "./biome/preset.json" }, name: "@shivaedev/quality" }),
			path: `${QUALITY}/package.json`,
		},
		{ content: JSON.stringify({ linter: { rules } }, null, "\t"), path: `${QUALITY}/biome/preset.json` },
		...(declarations === undefined ? [] : [{ content: JSON.stringify(declarations), path: `${QUALITY}/biome/declarations.json` }]),
	];
}

// A shortcut: the rule compares the preset against this list instead of asking the installed Biome.
export function biomeRecommends(...rules: readonly string[]): Rule<"suppressions/biome-recommended", undefined> {
	return biomeRecommendedFrom(() => Effect.succeed(rules));
}
