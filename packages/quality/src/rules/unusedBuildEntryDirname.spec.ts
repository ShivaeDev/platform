import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const tools = [
	["esbuild", 'import { build } from "esbuild"; build({ entryPoints });', { esbuild: "*" }],
	["Rolldown", 'import { build } from "rolldown"; build({ input: entryPoints });', { rolldown: "*" }],
	["Bun", "await Bun.build({ entrypoints: entryPoints });", {}],
] as const;

const roots = [
	[
		"dirname(import.meta.dirname)",
		'import { dirname, join } from "node:path"; const root = dirname(import.meta.dirname); const entryPoints = [join(root, "src/main.ts"), join(root, "src/preload.ts")];',
	],
	[
		"dirname(fileURLToPath(import.meta.url))",
		'import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url"; const root = dirname(fileURLToPath(import.meta.url)); const entryPoints = [join(root, "../src/main.ts"), join(root, "../src/preload.ts")];',
	],
] as const;

for (const [tool, invocation, dependencies] of tools) {
	for (const [root, entries] of roots) {
		ruleStory.it(
			`code/unused follows ${tool} entries rooted with ${root}`,
			[
				repositoryHas(
					{
						content: JSON.stringify({
							devDependencies: dependencies,
							name: "desktop",
							private: true,
							scripts: { build: "node script/build.ts" },
							type: "module",
						}),
						path: "package.json",
					},
					{
						content: `${entries}\n${invocation}`,
						path: "script/build.ts",
					},
					{ content: "export const main = 1;", path: "src/main.ts" },
					{ content: "export const preload = 1;", path: "src/preload.ts" },
					{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
				),
			],
			function* ({ check }) {
				const findings = yield* check(unusedCode);

				expect(findings).toEqual([expect.objectContaining({ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" })]);
			},
		);
	}
}
