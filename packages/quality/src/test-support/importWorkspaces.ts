import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";
import { importTree, linkWorkspace } from "./imports.ts";
import { config, seedTree } from "./tree.ts";

export function generatedPlaceholderWorkspace(): string {
	const root = importTree("unresolvable");
	writeFileSync(join(root, ".gitignore"), "src/generated/*\n!src/generated/.gitkeep\n");
	mkdirSync(join(root, "src", "generated"));
	writeFileSync(join(root, "src", "generated", ".gitkeep"), "");
	git(root, "init", "--quiet");
	git(root, "add", "src/generated/.gitkeep");
	return root;
}

export function trackedGeneratedWorkspace(): string {
	const root = importTree("unresolvable");
	mkdirSync(join(root, "src", "generated"));
	writeFileSync(join(root, "src", "generated", "kept.ts"), "export const kept = 1;\n");
	git(root, "init", "--quiet");
	git(root, "add", "--force", "src/generated/kept.ts");
	return root;
}

export function linkedWorkspace(): string {
	const root = importTree("resolution");
	linkWorkspace(root, "@demo/shared", "packages/shared");
	return root;
}

export function misdirectedWorkspace(): string {
	const root = importTree("empty");
	writeFileSync(join(root, "quality.config.ts"), 'export default { sources: ["docs"] };\n');
	return root;
}

export function productionImportsTestsWorkspace(): string {
	return seedTree([
		config('{ sources: ["src"] }'),
		{ content: 'import "./app.test.ts";\nimport "./test-support/fixture.ts";', path: "src/app.ts" },
		{ content: 'import "./test-support/fixture.ts";', path: "src/app.test.ts" },
		{ content: "export const fixture = 1;", path: "src/test-support/fixture.ts" },
	]);
}
