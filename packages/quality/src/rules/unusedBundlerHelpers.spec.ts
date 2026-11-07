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
		"dirname of import.meta.dirname",
		'import { dirname, join } from "node:path"; const root = dirname(import.meta.dirname); build({ entryPoints: [join(root, "src/main.ts"), join(root, "src/preload.ts")] });',
		undefined,
	],
	[
		"dirname of fileURLToPath(import.meta.url)",
		'import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url"; const root = dirname(fileURLToPath(import.meta.url)); build({ entryPoints: [join(root, "../src/main.ts"), join(root, "../src/preload.ts")] });',
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

ruleStory.it(
	"code/unused follows Rolldown entries through a package import alias, mapped helper configs and imported.meta.dirname",
	[
		effectResolves(),
		repositoryHas(
			{
				content: JSON.stringify({
					devDependencies: { effect: "*", rolldown: "*" },
					imports: { "#script/*": "./script/*" },
					name: "desktop",
					private: true,
					scripts: { build: "node script/build.ts" },
					type: "module",
				}),
				path: "package.json",
			},
			{
				content: `import { dirname } from "node:path";
import { Effect } from "effect";
import { bundleMainAndPreload } from "#script/adapters/bundler.ts";
const desktopRoot = dirname(import.meta.dirname);
void Effect.runPromise(Effect.gen(function* () { yield* bundleMainAndPreload(desktopRoot); }));`,
				path: "script/build.ts",
			},
			{
				content: `import { join } from "node:path";
import { Effect } from "effect";
import { build, watch } from "rolldown";
const configs = (root: string) => [{ input: join(root, "src", "main.ts") }, { input: join(root, "src", "preload.ts") }];
export const bundleMainAndPreload = (root: string) => Effect.promise(() => Promise.all(configs(root).map((config) => build(config))));
export const watchAll = (root: string) => watch(configs(root));`,
				path: "script/adapters/bundler.ts",
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
