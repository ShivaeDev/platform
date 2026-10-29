import type { SeedFile } from "./tree.ts";

export const docsWorkspace: readonly SeedFile[] = [
	{ content: JSON.stringify({ name: "tools", private: true, repository: "github:acme/tools" }), path: "package.json" },
	{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
	{
		content: JSON.stringify({
			exports: { "./*.ts": { default: "./dist/*.js", source: "./src/*.ts" }, "./internal/*": null },
			name: "@acme/lib",
		}),
		path: "packages/lib/package.json",
	},
	{ content: "export function makeRepository(): number {\n\treturn 1;\n}\n", path: "packages/lib/src/repository.ts" },
	{ content: "export const hidden = 1;\n", path: "packages/lib/src/internal/secret.ts" },
	{ content: JSON.stringify({ name: "@acme/app", private: true }), path: "packages/app/package.json" },
];

export function markdown(path: string, ...lines: readonly string[]): SeedFile {
	return { content: `${lines.join("\n")}\n`, path };
}
