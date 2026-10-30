import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { formatTree, qualityTree } from "#quality-fixtures/qualityTree.ts";
import type { SeedFile } from "#quality-fixtures/tree.ts";

function repository(): string {
	const root = qualityTree([
		{
			content: JSON.stringify({
				dependencies: { effect: "*" },
				devDependencies: { "@shivaedev/quality": "*", vitest: "*" },
				name: "policy-fixture",
				private: true,
				type: "module",
			}),
			path: "package.json",
		},
		{ content: 'export default { sources: ["src", "tooling"] };', path: "quality.config.ts" },
		{ content: "export function value() { return 1; }", path: "src/value.ts" },
		{ content: "export function value() { return 1; }", path: "tooling/value.ts" },
	]);
	for (const name of ["effect", "vitest"]) {
		const directory = dirname(createRequire(import.meta.url).resolve(`${name}/package.json`));
		symlinkSync(directory, join(root, `node_modules/${name}`), "dir");
	}
	return root;
}

export const effectPolicyStory = storyKit({
	create: () => Effect.acquireRelease(Effect.sync(repository), (root) => Effect.sync(() => rmSync(root, { force: true, recursive: true }))),
	name: "Effect policy",
	stages: ["repository"],
	verbs: (root, story) => ({
		baseline: (rule: string) => Effect.promise(() => runQuality(root, "baseline", "write", "--rule", rule)),
		lint: () =>
			Effect.promise(() => {
				story.tell("the author runs quality lint");
				return runQuality(root, "lint");
			}),
		writes: (file: SeedFile) =>
			Effect.sync(() => {
				story.tell(`the author writes ${file.path}`);
				write(root, file);
				formatTree(root);
			}),
	}),
});

function write(root: string, file: SeedFile): void {
	const path = join(root, file.path);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, file.content);
}

export function policyFiles(...files: readonly SeedFile[]) {
	return effectPolicyStory.trait("repository", "the repository contains policy examples", (root) => {
		for (const file of files) {
			write(root, file);
		}
		formatTree(root);
	});
}
