import { expect } from "vitest";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const UNLISTED = "Missing package dependency. Declare it in the importing package's manifest:";

const HOST_PLUGIN = [
	{ content: '{"name":"host-plugin","type":"module","exports":"./src/plugin.js"}', path: "package.json" },
	{ content: 'declare module "host-runtime" { export const register: () => void; }', path: "src/host.d.ts" },
	{
		content: 'import {register} from "host-runtime"; import {missing} from "missing-runtime"; export const plugin = [register, missing];',
		path: "src/plugin.js",
	},
];

ruleStory.it(
	"unused-code reports an undeclared runtime as unlisted but accepts a host module that a file of the project declares",
	[repositoryHas(...HOST_PLUGIN, { content: '{"include":["src"],"compilerOptions":{"allowJs":true}}', path: "tsconfig.json" })],
	function* ({ check, messages }) {
		yield* check(unusedCode);

		expect(yield* messages()).toEqual([`${UNLISTED} missing-runtime.`]);
	},
);

ruleStory.it(
	"unused-code reports a host module as unlisted when its declaration lies outside the importing file's project",
	[repositoryHas(...HOST_PLUGIN, { content: '{"include":["src/plugin.js"],"compilerOptions":{"allowJs":true}}', path: "tsconfig.json" })],
	function* ({ check, messages }) {
		yield* check(unusedCode);

		expect((yield* messages()).toSorted()).toEqual([`${UNLISTED} host-runtime.`, `${UNLISTED} missing-runtime.`]);
	},
);
