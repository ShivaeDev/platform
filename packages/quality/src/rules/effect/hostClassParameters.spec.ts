import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { adapterServiceFiles } from "#test/adapterServiceFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"service parameters accepts a class callback from a foreign interface and reports a local interface callback",
	[
		effectResolves(),
		repositoryHas(
			...adapterServiceFiles.slice(0, 3),
			{
				content: `import type { ViteDevServer } from "vite";
export interface TestCase { readonly server: ViteDevServer; }
export interface Reporter { onTestCaseResult(testCase: TestCase): void; }`,
				path: "node_modules/vitest.d.ts",
			},
			{
				content: `import type { Reporter } from "vitest";
import type { ViteDevServer } from "vite";
export class VitestReporter implements Reporter { onTestCaseResult(testCase: import("vitest").TestCase) { void testCase.server.close(); } }
interface LocalReporter { onTestCaseResult(testCase: ViteDevServer): void; }
export class Local implements LocalReporter { onTestCaseResult(testCase: ViteDevServer) { void testCase.close(); } }`,
				path: "src/adapters/reporter.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([expect.objectContaining({ file: "src/adapters/reporter.ts", line: 5 })]);
	},
);
