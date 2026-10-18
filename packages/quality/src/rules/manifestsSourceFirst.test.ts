import { afterEach, describe, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { git } from "#test/git.ts";
import { config, linkPackage, removeSeededTrees, type SeedFile, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

const SOURCE_FIRST = '{ "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" }';

const TYPES_FIRST = '{ "types": "./dist/*.d.ts", "source": "./src/*.ts", "default": "./dist/*.js" }';

function manifest(exports: string, imports = "{}"): string {
	const text = `{ "name": "sample", "imports": ${imports}, "exports": ${exports} }`;
	return `${JSON.stringify(JSON.parse(text), null, "\t")}\n`;
}

function repository(...files: readonly SeedFile[]): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\nignored/\n", path: ".gitignore" },
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content: "export const MAX_DEPTH = 4;\nexport const MAX_ITEMS = 10;\n", path: "src/limits.ts" },
		...files,
	]);
	linkPackage(root);
	git(root, "init", "--quiet");
	return root;
}

function message(first: string, field: string): string {
	return `Lists the "source" condition after "${first}" in ${field}. TypeScript takes the first condition that matches, so once built output exists it reads that instead of the sources the "source" condition names. Move "source" to the top of this condition block.`;
}

describe("manifests/source-first", { timeout: 60_000 }, () => {
	it("reports every exports and imports condition block that lists source after another condition, nested blocks too", () => {
		const root = repository(
			{ content: manifest(`{ "./*.ts": ${TYPES_FIRST} }`), path: "packages/a/package.json" },
			{ content: manifest(`{ "./*.ts": ${SOURCE_FIRST} }`, `{ "#*.ts": { "node": ${TYPES_FIRST} } }`), path: "packages/b/package.json" },
			{ content: manifest(`{ "./*.ts": ${TYPES_FIRST} }`), path: "ignored/package.json" },
		);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			`  packages/a/package.json:5  ${message("types", "exports")}\n  packages/b/package.json:5  ${message("types", "imports")}\n\n`,
		);
	});

	it("passes manifests that list source first or do not use it", () => {
		const root = repository(
			{ content: manifest(`{ "./*.ts": ${SOURCE_FIRST} }`, `{ "#*.ts": ${SOURCE_FIRST} }`), path: "packages/a/package.json" },
			{ content: manifest('{ "./*.ts": { "types": "./dist/*.d.ts", "default": "./dist/*.js" } }'), path: "packages/b/package.json" },
		);
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});
});
