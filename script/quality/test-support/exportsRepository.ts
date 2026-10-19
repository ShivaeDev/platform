import { repositoryHas } from "./ruleKit.ts";

export const filePathExports = {
	"./*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" },
	"./package.json": "./package.json",
};

export function packageExports(exports: unknown, path = "modules/library/package.json") {
	return { content: JSON.stringify({ exports, name: "@acme/library" }), path };
}

export function workspaceWithExports(exports: unknown) {
	return repositoryHas(
		{ content: '{ "name": "workspace", "private": true, "workspaces": ["modules/*"] }', path: "package.json" },
		packageExports(exports),
	);
}
