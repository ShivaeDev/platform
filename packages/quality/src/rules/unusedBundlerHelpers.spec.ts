import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [form, script, helper] of [
	[
		"mapped configs",
		'const configs = [{ entryPoints: ["src/main.ts"] }, { entryPoints: ["src/preload.ts"] }]; configs.map((config) => build(config));',
		undefined,
	],
	[
		"mapped Bun configs",
		'const configs = [{ entrypoints: ["src/main.ts"] }, { entrypoints: ["src/preload.ts"] }]; configs.map((config) => Bun.build(config));',
		undefined,
	],
	["a local helper", 'const entries = ["src/main.ts", "src/preload.ts"]; bundle(entries);', undefined],
	["a spread", 'const entries = ["src/main.ts", "src/preload.ts"]; bundle([...entries]);', undefined],
	[
		"an Effect acquisition callback",
		'import { Effect } from "effect"; const entries = ["src/main.ts", "src/preload.ts"]; void Effect.runPromise(Effect.gen(function* () { yield* Effect.promise(() => bundle(entries)); }));',
		undefined,
	],
	[
		"an imported helper",
		'import { bundle } from "./bundle.ts"; const entries = ["src/main.ts", "src/preload.ts"]; bundle(entries);',
		'import { build } from "esbuild"; export function bundle(entryPoints: string[]) { return build({entryPoints}); }',
	],
] as const) {
	ruleStory.it(
		`code/unused follows desktop entries through ${form} and tool configs while reporting abandoned files`,
		[
			...(script.includes('from "effect"') ? [effectResolves()] : []),
			repositoryHas(
				{
					content: JSON.stringify({
						devDependencies: { esbuild: "*", ...(script.includes('from "effect"') ? { effect: "*" } : {}) },
						name: "desktop",
						private: true,
						scripts: { build: "node script/build.ts" },
						type: "module",
					}),
					path: "package.json",
				},
				{
					content:
						helper === undefined
							? `import { build } from "esbuild";
function bundle(entryPoints: string[]) { return build({ entryPoints }); }
function unused() { return build({entryPoints: ["src/abandoned.ts"]}); }
${script}`
							: script,
					path: "script/build.ts",
				},
				...(helper === undefined ? [] : [{ content: helper, path: "script/bundle.ts" }]),
				{ content: "export const main = 1;", path: "src/main.ts" },
				{ content: "export const preload = 1;", path: "src/preload.ts" },
				{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
				{ content: "export default {};", path: ".dependency-cruiser.ts" },
				{ content: "export default {};", path: "script/test/vitest.config.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			expect(findings).toEqual([expect.objectContaining({ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" })]);
		},
	);
}
