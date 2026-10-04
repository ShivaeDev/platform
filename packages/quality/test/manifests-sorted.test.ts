import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "#test/support/cli.ts";
import { git } from "#test/support/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "#test/support/tree.ts";

afterEach(removeSeededTrees);

const unsorted = '{\n\t"version": "1.0.0",\n\t"name": "sample"\n}\n';

const sorted = '{\n\t"name": "sample",\n\t"version": "1.0.0"\n}\n';

function repository(...files: readonly SeedFile[]): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\nignored/\n", path: ".gitignore" },
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content: "export const a = 1;\n", path: "src/a.ts" },
		...files,
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

describe("manifests/sorted", { timeout: 60_000 }, () => {
	it("reports every package.json in the repository whose keys are out of order, outside the sources too", () => {
		const root = repository(
			{ content: unsorted, path: "package.json" },
			{ content: sorted, path: "packages/b/package.json" },
			{ content: unsorted, path: "packages/c/package.json" },
			{ content: unsorted, path: "ignored/package.json" },
		);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"  package.json  Keys are not in sort-package-json order. Run `quality fix`.\n  packages/c/package.json  Keys are not in sort-package-json order. Run `quality fix`.\n\n",
		);
	});

	it("reports a package.json that is not valid JSON", () => {
		const result = quality(repository({ content: '{ "name": ', path: "packages/c/package.json" }), "lint");
		expect(result.stdout).toContain("  packages/c/package.json  Is not valid JSON.\n");
	});

	it("is sorted by quality fix, after which the lint passes", () => {
		const root = repository({ content: unsorted, path: "package.json" }, { content: unsorted, path: "packages/c/package.json" });
		expect(quality(root, "fix").stdout).toBe(
			"quality: sort-package-json rewrote 2 manifests.\nquality: Biome round 1 rewrote 0 files with fixes and 0 files with the format pass.\n",
		);
		expect(readFileSync(join(root, "package.json"), "utf8")).toBe(sorted);
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});
});
