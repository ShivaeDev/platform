import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { manifestsApplication } from "#rules/manifestsApplication.ts";
import { application, entryPointWorkspace, HOIST_WORKSPACE, PLAIN_WORKSPACE, platformApp } from "#test/applicationFiles.ts";

const app = application("modules/app/package.json", platformApp);

ruleKit.it(
	"an application's workspace hoists the pieces platform brings",
	[repositoryHas(...entryPointWorkspace, PLAIN_WORKSPACE, app)],
	function* ({ checks, writes }) {
		const findings = yield* checks(manifestsApplication);
		expect(findings.map((finding) => [finding.file, finding.subject])).toEqual([["modules/app/package.json", "publicHoistPattern"]]);
		expect(findings[0]?.message).toContain('Add `publicHoistPattern: ["@shivaedev/*"]` to pnpm-workspace.yaml');
		yield* writes(HOIST_WORKSPACE);
		expect(yield* checks(manifestsApplication)).toEqual([]);
	},
);

ruleKit.it(
	"a negated hoist pattern does not count as hoisting the pieces",
	[
		repositoryHas(...entryPointWorkspace, app, {
			content: 'packages: [modules/*]\npublicHoistPattern:\n  - "*"\n  - "!@shivaedev/*"\n',
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ checks }) {
		expect((yield* checks(manifestsApplication)).map((finding) => finding.subject)).toEqual(["publicHoistPattern"]);
	},
);

ruleKit.it(
	"an application lists no piece beside the entry point that brings it",
	[
		repositoryHas(
			...entryPointWorkspace,
			HOIST_WORKSPACE,
			application("modules/app/package.json", {
				dependencies: { ...platformApp.dependencies, "@shivaedev/sql": "workspace:*" },
				devDependencies: { ...platformApp.devDependencies, "@shivaedev/test": "workspace:*" },
			}),
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(manifestsApplication);
		expect(findings.map((finding) => finding.subject)).toEqual(["@shivaedev/sql", "@shivaedev/test"]);
		expect(findings[0]?.message).toBe(
			'Lists "@shivaedev/sql" in dependencies beside "@shivaedev/platform", which already brings it. Remove "@shivaedev/sql" from dependencies and keep importing it by its own name.',
		);
	},
);

ruleKit.it(
	"a library declares its pieces directly without the hoist setting",
	[
		repositoryHas(...entryPointWorkspace, PLAIN_WORKSPACE, {
			content: `${JSON.stringify({ dependencies: { "@shivaedev/sql": "workspace:*" }, devDependencies: { "@shivaedev/test": "workspace:*", "@shivaedev/test-story": "workspace:*" }, name: "@shivaedev/library" })}\n`,
			path: "modules/library/package.json",
		}),
	],
	function* ({ checks }) {
		expect(yield* checks(manifestsApplication)).toEqual([]);
	},
);
