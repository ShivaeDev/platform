import { repositoryHas } from "#test/ruleStory.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";

function shellFiles(exports: object, sources: readonly SeedFile[]): readonly SeedFile[] {
	return [
		{ content: "node_modules/\n", path: ".gitignore" },
		{ content: JSON.stringify({ name: "workspace", private: true, type: "module" }), path: "package.json" },
		{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
		{ content: JSON.stringify({ exports: { ".": "./index.js" }, name: "piece", type: "module" }), path: "packages/piece/package.json" },
		{ content: "export const piece = 1;", path: "packages/piece/index.js" },
		{
			content: JSON.stringify({ dependencies: { piece: "workspace:*" }, exports, name: "shell", type: "module" }),
			path: "packages/shell/package.json",
		},
		...sources,
		{ content: JSON.stringify({ exports: { ".": "./index.js" }, name: "piece", type: "module" }), path: "node_modules/piece/package.json" },
		{ content: "export const piece = 1;", path: "node_modules/piece/index.js" },
	];
}

export function codeFreeShell() {
	return [repositoryHas(...shellFiles({ "./package.json": "./package.json" }, []))];
}

export function shellWithCode() {
	return [
		repositoryHas(
			...shellFiles({ ".": "./src/index.ts", "./package.json": "./package.json" }, [
				{ content: "export const shell = 1;", path: "packages/shell/src/index.ts" },
			]),
		),
	];
}
