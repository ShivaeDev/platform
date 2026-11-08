import { expect } from "@effect/vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"code/unused counts dependencies named in an imported bundler external list as used while reporting one nothing names",
	[
		repositoryHas(
			{
				content: JSON.stringify({
					dependencies: { "abandoned-sdk": "*", "external-sdk": "*" },
					devDependencies: { rolldown: "*" },
					imports: { "#script/*": "./script/*" },
					name: "desktop",
					private: true,
					scripts: { build: "node script/build.ts" },
					type: "module",
				}),
				path: "package.json",
			},
			{ content: 'export const EXTERNALS = ["external-sdk", "electron"];', path: "script/externals.ts" },
			{
				content: `import { build } from "rolldown";
import { EXTERNALS } from "#script/externals.ts";
build({ external: EXTERNALS.filter((name) => name !== "electron"), input: "src/main.ts" });`,
				path: "script/build.ts",
			},
			{ content: "export const main = 1;", path: "src/main.ts" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(unusedCode);

		expect(findings).toEqual([expect.objectContaining({ file: "package.json", subject: "dependencies:abandoned-sdk" })]);
	},
);
