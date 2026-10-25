import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { makeRoot, roots } from "./inventoryRepository.ts";
import { removeSeededTrees, seedTree } from "./tree.ts";

const blockedDirectories: string[] = [];

export function unreadableManifestRepository(): string {
	const root = makeRoot();
	mkdirSync(join(root, "package.json"));
	return root;
}

export function blockedInventoryDirectory(): string {
	const blocked = join(makeRoot(), "packages");
	mkdirSync(blocked);
	chmodSync(blocked, 0o000);
	blockedDirectories.push(blocked);
	return blocked;
}

export function removeInventoryRepositories(): void {
	for (const directory of blockedDirectories.splice(0)) {
		chmodSync(directory, 0o755);
	}
	removeSeededTrees();
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
}

export function unicodePathsRepository(): string {
	const paths = [
		"src/\uE000.ts",
		"src/😀.ts",
		"src/𐀀.ts",
		"src/á.ts",
		"src/e\u0301.ts",
		"src/aa.ts",
		"src/a2.ts",
		"src/a10.ts",
		"src/a.ts",
		"src/Z.ts",
		"src/B.ts",
	];
	return seedTree(paths.map((path) => ({ content: path, path })));
}
