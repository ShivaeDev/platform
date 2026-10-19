import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { linkWorkspace } from "#test/imports.ts";
import { formatTree, qualityTree } from "#test/qualityTree.ts";

export const fenceConfig = [
	'import { defineConfig } from "@shivaedev/quality/config.ts";',
	'import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";',
	'import { folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";',
	"",
	'const game = fence("game-keeps-out-of-cms").because("The game ships to players.").from(folders("packages/game/src")).mayNotImport(packages("cms"))',
	'  .demonstratedBy({ illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"], legal: ["packages/game/src/a.ts", "packages/game/src/b.ts"] });',
	'export default defineConfig({ rules: { "imports/fences": { options: { fences: [game] } } } });',
].join("\n");

export function seedFences(): string {
	const root = qualityTree([
		{ content: '{ "type": "module", "devDependencies": { "@shivaedev/quality": "*" } }', path: "package.json" },
		{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
		{ content: '{ "name": "@demo/game", "dependencies": { "@demo/cms": "workspace:*" } }', path: "packages/game/package.json" },
		{
			content:
				'{ "name": "@demo/cms", "exports": { ".": "./src/edit.ts", "./*.ts": { "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" } } }',
			path: "packages/cms/package.json",
		},
		{ content: 'import { edit } from "@demo/cms";\n\nexport const play = edit;\n', path: "packages/game/src/play.ts" },
		{ content: "export function run(): number {\n\treturn 1;\n}\n", path: "packages/game/src/run.ts" },
		{ content: "export function edit(): number {\n\treturn 1;\n}\n", path: "packages/cms/src/edit.ts" },
	]);
	linkWorkspace(root, "@demo/cms", "packages/cms");
	writeFileSync(join(root, "quality.config.ts"), fenceConfig);
	return formatTree(root);
}

export function register(root: string, entries: readonly object[]): void {
	mkdirSync(join(root, "quality"), { recursive: true });
	writeFileSync(join(root, "quality", "registry.json"), JSON.stringify(entries));
}
