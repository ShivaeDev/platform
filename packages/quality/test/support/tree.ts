import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface SeedFile {
	readonly content: string;
	readonly path: string;
}

export const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const seeded: string[] = [];

export const seedTree = (...groups: ReadonlyArray<ReadonlyArray<SeedFile>>): string => {
	const root = mkdtempSync(join(tmpdir(), "quality-tree-"));
	seeded.push(root);
	for (const file of groups.flat()) {
		const full = join(root, file.path);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, file.content);
	}
	return root;
};

/** Makes the package importable from a seeded tree, the way an installed consumer resolves it. */
export const linkPackage = (root: string): void => {
	mkdirSync(join(root, "node_modules", "@shivaedev"), { recursive: true });
	symlinkSync(packageRoot, join(root, "node_modules", "@shivaedev", "quality"), "dir");
};

export const removeSeededTrees = (): void => {
	for (const root of seeded.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
};

export const lines = (count: number): string => "export const n = 1;\n".repeat(count);

export const config = (body: string): SeedFile => ({ content: `export default ${body};\n`, path: "quality.config.ts" });
