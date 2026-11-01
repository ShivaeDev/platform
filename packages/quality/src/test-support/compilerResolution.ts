import type { SeedFile } from "./tree.ts";

export const conditionalWorkspace: readonly SeedFile[] = [
	{ content: '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext","paths":{"~/*":["./src/*"]}}}', path: "compiler.json" },
	{ content: '{"extends":"./compiler.json","include":["src"]}', path: "tsconfig.json" },
	{ content: 'import "~/aliased.ts";\nimport "@demo/shared";\nimport "@demo/shared/private";', path: "src/main.mts" },
	{ content: 'import shared = require("@demo/shared");\nexport { shared };\nvoid import("@demo/shared");', path: "src/main.cts" },
	{ content: "export const aliased = 1;", path: "src/aliased.ts" },
	{
		content: JSON.stringify({
			exports: { ".": { import: "./src/imported.mts", require: "./src/required.cts", source: "./src/source.ts" } },
			name: "@demo/shared",
		}),
		path: "packages/shared/package.json",
	},
	{ content: "export const imported = 1;", path: "packages/shared/src/imported.mts" },
	{ content: "export const required = 1;", path: "packages/shared/src/required.cts" },
	{ content: "export const source = 1;", path: "packages/shared/src/source.ts" },
	{ content: "export const privateValue = 1;", path: "packages/shared/private.ts" },
];

export const legacyWorkspace: readonly SeedFile[] = [
	{ content: '{"compilerOptions":{"module":"CommonJS","moduleResolution":"Node10"}}', path: "tsconfig.json" },
	{ content: 'import "@demo/shared";', path: "src/main.ts" },
	{
		content: '{"name":"@demo/shared","main":"./src/legacy.js","exports":"./src/exported.js"}',
		path: "packages/shared/package.json",
	},
	{ content: "exports.legacy = 1;", path: "packages/shared/src/legacy.js" },
	{ content: "exports.exported = 1;", path: "packages/shared/src/exported.js" },
];
