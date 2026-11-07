import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const [name, invocation] of [
	["build", 'build({ input: "src/main.ts" });'],
	["watch", 'watch({ input: { app: "src/main.ts" } });'],
	["build config array", 'const config = { input: "src/main.ts" }; build([config]);'],
	["watch config array", 'const configs = [{ input: "src/main.ts" }]; watch(configs);'],
	[
		"mapped configs",
		'const configs = [{ input: ["src/main.ts"] }, { input: "src/preload.ts" }]; const resolved = configs; await Promise.all(resolved.map((config) => build(config)));',
	],
] as const) {
	ruleStory.it(
		`code/unused follows Rolldown ${name} entries and their exports while rejecting an uncalled helper`,
		[
			repositoryHas(
				{
					content: JSON.stringify({ devDependencies: { rolldown: "*" }, name: "desktop", private: true, scripts: { build: "node script/build.ts" } }),
					path: "package.json",
				},
				{
					content: `import { build, watch } from "rolldown";
function unused() { return build({ input: "src/abandoned.ts" }); }
${invocation}`,
					path: "script/build.ts",
				},
				{ content: 'import { used } from "./shared.ts"; console.log(used);', path: "src/main.ts" },
				{ content: "export const used = 1; export const abandoned = 2;", path: "src/shared.ts" },
				...(name === "mapped configs" ? [{ content: "export const preload = 1;", path: "src/preload.ts" }] : []),
				{ content: "export const abandoned = 1;", path: "src/abandoned.ts" },
			),
		],
		function* ({ check }) {
			const findings = yield* check(unusedCode);

			expect(findings).toEqual([
				expect.objectContaining({ file: "src/abandoned.ts", subject: "files:src/abandoned.ts" }),
				expect.objectContaining({ file: "src/shared.ts", subject: "exports:abandoned" }),
			]);
		},
	);
}
