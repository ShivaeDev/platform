import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [form, script, helper] of [
	["a local helper", 'const entries = ["src/main.ts", "src/preload.ts"]; bundle(entries);', undefined],
	["a spread", 'const entries = ["src/main.ts", "src/preload.ts"]; bundle([...entries]);', undefined],
	[
		"an imported helper",
		'import { bundle } from "./bundle.ts"; const entries = ["src/main.ts", "src/preload.ts"]; bundle(entries);',
		'import { build } from "esbuild"; export function bundle(entryPoints: string[]) { return build({entryPoints}); }',
	],
] as const) {
	ruleStory.it(
		`code/unused follows desktop entries through ${form} and tool configs while reporting abandoned files`,
		[
			repositoryHas(
				{
					content: '{"name":"desktop","private":true,"type":"module","scripts":{"build":"node script/build.ts"},"devDependencies":{"esbuild":"*"}}',
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
			expect(yield* check(unusedCode)).toEqual([expect.objectContaining({ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" })]);
		},
	);
}
