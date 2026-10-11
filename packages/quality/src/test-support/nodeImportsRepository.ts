import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { config, linkPackage, seedTree } from "./tree.ts";

export function nodeImportsRepository(content: string): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\n", path: ".gitignore" },
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content, path: "src/value.ts" },
		{ content: '{ "value": 1 }\n', path: "src/value.json" },
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

export function repairsImport(root: string, content: string): void {
	writeFileSync(join(root, "src/value.ts"), content);
}
