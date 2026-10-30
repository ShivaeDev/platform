import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { unusedCode } from "#rules/unusedCode.ts";

const project = repositoryHas(
	{ content: '{"name":"host-plugin","type":"module","exports":"./src/plugin.js"}', path: "package.json" },
	{ content: '{"include":["src"],"compilerOptions":{"allowJs":true}}', path: "tsconfig.json" },
	{ content: 'declare module "host-runtime" { export const register: () => void; }', path: "src/host.d.ts" },
	{
		content: 'import {register} from "host-runtime"; import {missing} from "missing-runtime"; export const plugin = [register, missing];',
		path: "src/plugin.js",
	},
);

ruleKit.it("accepts a declared host module while rejecting an undeclared dependency", [project], function* ({ checks }) {
	const findings = yield* checks(unusedCode);
	expect(findings.filter(({ subject }) => subject?.startsWith("unlisted:")).map(({ subject }) => subject)).toEqual(["unlisted:missing-runtime"]);
});

ruleKit.it("does not borrow a host declaration excluded from the importing project", [project], function* ({ checks, writes }) {
	yield* writes({ content: '{"include":["src/plugin.js"],"compilerOptions":{"allowJs":true}}', path: "tsconfig.json" });
	const findings = yield* checks(unusedCode);
	expect(
		findings
			.filter(({ subject }) => subject?.startsWith("unlisted:"))
			.map(({ subject }) => subject)
			.toSorted(),
	).toEqual(["unlisted:host-runtime", "unlisted:missing-runtime"]);
});
