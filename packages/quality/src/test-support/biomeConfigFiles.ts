import type { SeedFile } from "#testing/adapters/tree.ts";

export const ACME = "node_modules/@acme/lint";

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
