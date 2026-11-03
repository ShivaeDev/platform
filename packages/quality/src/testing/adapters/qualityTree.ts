import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { linkPackage, type SeedFile, seedTree } from "./tree.ts";

const BIN = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

export function formatTree(root: string): string {
	const result = spawnSync(process.execPath, [BIN, "format", "--write", ".", "--colors=off"], { cwd: root, encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`Cannot format the fixture: ${result.stdout}${result.stderr}`);
	}
	return root;
}

export function qualityTree(...groups: ReadonlyArray<readonly SeedFile[]>): string {
	const root = seedTree(
		[
			{ content: "node_modules/\n", path: ".gitignore" },
			{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
		],
		...groups,
	);
	linkPackage(root);
	return formatTree(root);
}
