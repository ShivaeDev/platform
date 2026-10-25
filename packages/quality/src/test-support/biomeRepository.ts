import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { config, linkPackage, type SeedFile, seedTree } from "./tree.ts";

function biome(content: string): SeedFile {
	return { content: `${content}\n`, path: "biome.json" };
}

const preset = biome('{ "extends": ["@shivaedev/quality/biome/preset.json"] }');

const looseType: SeedFile = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/parse.ts" };

function biomeRepository(...files: readonly SeedFile[]): string {
	const root = seedTree([config('{ sources: ["src"] }'), { content: "node_modules/\n", path: ".gitignore" }, ...files]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

export function addUntypedParser(root: string): void {
	writeFileSync(join(root, looseType.path), `${looseType.content}\nexport function revive(text: string): any {\n\treturn JSON.parse(text);\n}\n`);
}

export function biomeFindingsRepository(): string {
	return biomeRepository(preset, looseType, { content: "export const b = 1\n", path: "src/b.ts" });
}

export function untypedParserRepository(): string {
	return biomeRepository(preset, looseType);
}

export function missingPresetRepository(): string {
	return biomeRepository(biome('{ "extends": [] }'), looseType);
}

export function warningOverrideRepository(): string {
	return biomeRepository(
		biome(
			'{ "extends": ["@shivaedev/quality/biome/preset.json"], "overrides": [{ "includes": ["src/parse.ts"], "linter": { "rules": { "suspicious": { "noExplicitAny": "warn" } } } }] }',
		),
		looseType,
	);
}

export function invalidBiomeRepository(): string {
	return biomeRepository(biome('{ "extends": ["@shivaedev/quality/biome/preset.json"], "linter": { "unknownKey": true } }'), looseType);
}

export function unorderedDuplicateKeysRepository(): string {
	return biomeRepository(preset, { content: "export const b = { z: 1, a: 2 }\nexport const twice = { a: 1, a: 2 }\n", path: "src/b.ts" });
}

export function successiveFixesRepository(): string {
	const twoRounds: SeedFile = {
		content: 'export function isA(text: string): boolean {\n\treturn text.indexOf("a") == 0;\n}\n',
		path: "src/is-a.ts",
	};
	return biomeRepository(preset, twoRounds);
}
