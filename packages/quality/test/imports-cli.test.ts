import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality } from "./support/cli.ts";
import { importTree } from "./support/imports.ts";
import { linkPackage, removeSeededTrees } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

const fenceConfig = [
	'import { defineConfig, fence, folders, packages } from "@shivaedev/quality";',
	'const game = fence("game-keeps-out-of-cms").because("The game ships to players.").from(folders("packages/game/src")).mayNotImport(packages("cms"))',
	'  .demonstratedBy({ illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"], legal: ["packages/game/src/a.ts", "packages/game/src/b.ts"] });',
	'export default defineConfig({ rules: { biome: "off", "imports/aliased": "off", "imports/fences": { options: { fences: [game] } }, "manifests/sorted": "off" } });',
].join("\n");

function seedFences(): string {
	const root = importTree("fence");
	writeFileSync(join(root, "quality.config.ts"), fenceConfig);
	linkPackage(root);
	return root;
}

function register(root: string, entries: readonly object[]): void {
	mkdirSync(join(root, "quality"), { recursive: true });
	writeFileSync(join(root, "quality", "registry.json"), JSON.stringify(entries));
}

describe("the imports rules on the command line", { timeout: cliTimeout }, () => {
	it("exit 2 when the import graph covers no modules, so a misdirected config cannot pass", () => {
		const root = importTree("empty");
		writeFileSync(join(root, "quality.config.ts"), 'export default { rules: { biome: "off" }, sources: ["docs"] };\n');
		const result = quality(root, "lint");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("the import graph covers no modules");
	});

	it("take a registry exception for one fence in one file, and fail on one that exempts nothing", () => {
		const root = seedFences();
		expect(quality(root, "lint").stdout).toContain(
			'packages/game/src/play.ts:1  Imports packages/cms/src/edit.ts across the fence "game-keeps-out-of-cms"',
		);
		const reason = "The play screen previews CMS drafts until the preview service lands.";
		register(root, [{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" }]);
		expect(quality(root, "lint").status).toBe(0);
		register(root, [
			{ file: "packages/game/src/play.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
			{ file: "packages/game/src/run.ts", reason, rule: "imports/fences", subject: "game-keeps-out-of-cms" },
		]);
		const stale = quality(root, "lint");
		expect(stale.status).toBe(1);
		expect(stale.stdout).toContain("packages/game/src/run.ts");
	});
});
