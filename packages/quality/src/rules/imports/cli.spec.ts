import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "#test/cli.ts";
import { importTree, linkWorkspace } from "#test/imports.ts";
import { formatTree, qualityTree } from "#test/qualityTree.ts";
import { config, removeSeededTrees, seedTree } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

const fenceConfig = [
	'import { defineConfig } from "@shivaedev/quality/config.ts";',
	'import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";',
	'import { folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";',
	"",
	'const game = fence("game-keeps-out-of-cms").because("The game ships to players.").from(folders("packages/game/src")).mayNotImport(packages("cms"))',
	'  .demonstratedBy({ illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"], legal: ["packages/game/src/a.ts", "packages/game/src/b.ts"] });',
	'export default defineConfig({ rules: { "imports/fences": { options: { fences: [game] } } } });',
].join("\n");

function seedFences(): string {
	const root = qualityTree([
		{ content: '{ "type": "module", "devDependencies": { "@shivaedev/quality": "*" } }', path: "package.json" },
		{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
		{ content: '{ "name": "@demo/game", "dependencies": { "@demo/cms": "workspace:*" } }', path: "packages/game/package.json" },
		{ content: '{ "name": "@demo/cms", "exports": { ".": "./src/edit.ts" } }', path: "packages/cms/package.json" },
		{ content: 'import { edit } from "@demo/cms";\n\nexport const play = edit;\n', path: "packages/game/src/play.ts" },
		{ content: "export function run(): number {\n\treturn 1;\n}\n", path: "packages/game/src/run.ts" },
		{ content: "export function edit(): number {\n\treturn 1;\n}\n", path: "packages/cms/src/edit.ts" },
	]);
	linkWorkspace(root, "@demo/cms", "packages/cms");
	writeFileSync(join(root, "quality.config.ts"), fenceConfig);
	return formatTree(root);
}

function register(root: string, entries: readonly object[]): void {
	mkdirSync(join(root, "quality"), { recursive: true });
	writeFileSync(join(root, "quality", "registry.json"), JSON.stringify(entries));
}

describe("the imports rules on the command line", { timeout: CLI_TIMEOUT }, () => {
	it("exit 2 when the import graph covers no modules, so a misdirected config cannot pass", () => {
		const root = importTree("empty");
		writeFileSync(join(root, "quality.config.ts"), 'export default { sources: ["docs"] };\n');
		const result = quality(root, "lint");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("the import graph covers no modules");
		expect(result.stderr).toContain("Point `sources` at the TypeScript or JavaScript code.");
		expect(result.stderr).not.toContain("turn the imports rules off");
	});

	it("rejects production imports of tests by default and asks for shared production code", () => {
		const root = seedTree([
			config('{ sources: ["src"] }'),
			{ content: 'import "./app.test.ts";\nimport "./test-support/fixture.ts";', path: "src/app.ts" },
			{ content: 'import "./test-support/fixture.ts";', path: "src/app.test.ts" },
			{ content: "export const fixture = 1;", path: "src/test-support/fixture.ts" },
		]);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("imports/no-test-code");
		expect(result.stdout).toContain('src/app.ts:1  Imports test code through "./app.test.ts".');
		expect(result.stdout).toContain('src/app.ts:2  Imports test code through "./test-support/fixture.ts".');
		expect(result.stdout).toContain("Move the shared code into a production module and import it from both production and tests.");
	});

	it("take a registry exception for one fence in one file, and fail on one that exempts nothing", () => {
		const root = seedFences();
		expect(quality(root, "lint").stdout).toContain(
			'packages/game/src/play.ts:1  Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms"',
		);
		const reason = "The play screen previews CMS drafts until the preview service lands.";
		register(root, [{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" }]);
		expect(quality(formatTree(root), "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("quality: passed") });
		register(root, [
			{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
			{ file: "packages/game/src/run.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
		]);
		const stale = quality(root, "lint");
		expect(stale.status).toBe(1);
		expect(stale.stdout).toContain("packages/game/src/run.ts");
	});
});
