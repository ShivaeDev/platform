import type { SeedFile } from "./tree.ts";

const FENCE_CONFIG = [
	'import { defineConfig } from "@shivaedev/quality/config.ts";',
	'import { fence } from "@shivaedev/quality/imports/fence.ts";',
	'import { folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";',
	"",
	'const game = fence("game-keeps-out-of-cms").because("The game ships to players.").from(folders("packages/game/src")).mayNotImport(packages("cms"))',
	'  .demonstratedBy({ illegal: ["packages/game/src/a.ts", "packages/cms/src/b.ts"], legal: ["packages/game/src/a.ts", "packages/game/src/b.ts"] });',
	'export default defineConfig({ rules: { "imports/fences": { options: { fences: [game] } } } });',
].join("\n");

export const importFenceRepository: readonly SeedFile[] = [
	{ content: '{ "type": "module", "devDependencies": { "@shivaedev/quality": "*" } }', path: "package.json" },
	{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
	{
		content:
			'{ "name": "@demo/game", "exports": { "./*.ts": { "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" } }, "dependencies": { "@demo/cms": "workspace:*" } }',
		path: "packages/game/package.json",
	},
	{
		content:
			'{ "name": "@demo/cms", "exports": { ".": "./src/edit.ts", "./*.ts": { "source": "./src/*.ts", "types": "./dist/*.d.ts", "default": "./dist/*.js" } } }',
		path: "packages/cms/package.json",
	},
	{
		content: 'import { edit } from "@demo/cms";\n\nexport function play(): string {\n\treturn ["Draft", edit()].join(" ");\n}\n',
		path: "packages/game/src/play.ts",
	},
	{ content: "export function run(): number {\n\treturn 1;\n}\n", path: "packages/game/src/run.ts" },
	{ content: "export function edit(): number {\n\treturn 1;\n}\n", path: "packages/cms/src/edit.ts" },
	{ content: FENCE_CONFIG, path: "quality.config.ts" },
];

export function registry(...entries: readonly object[]): SeedFile {
	return { content: `${JSON.stringify(entries, undefined, "\t")}\n`, path: "quality/registry.json" };
}
