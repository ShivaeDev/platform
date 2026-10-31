import { expect } from "vitest";
import { manifestsApplication } from "#rules/manifestsApplication.ts";
import { application, entryPointWorkspace, HOIST_WORKSPACE, PLAIN_WORKSPACE, platformApp } from "#test/applicationFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const APP = application("modules/app/package.json", platformApp);

const UNHOISTED = {
	file: "modules/app/package.json",
	message:
		'Depends on "@shivaedev/platform", but pnpm-workspace.yaml does not hoist @shivaedev/*. Add `publicHoistPattern: ["@shivaedev/*"]` to pnpm-workspace.yaml so the pieces platform brings resolve by their own names.',
	subject: "publicHoistPattern",
};

const REPEATED_PIECES = [
	{ entry: "@shivaedev/platform", field: "dependencies", piece: "@shivaedev/sql" },
	{ entry: "@shivaedev/test-story", field: "devDependencies", piece: "@shivaedev/test" },
] as const;

ruleStory.it(
	"manifests/application asks an application on platform to hoist @shivaedev/* until its pnpm workspace does",
	[repositoryHas(...entryPointWorkspace, PLAIN_WORKSPACE, APP)],
	function* ({ check, writes }) {
		expect(yield* check(manifestsApplication)).toEqual([UNHOISTED]);

		yield* writes(HOIST_WORKSPACE);

		expect(yield* check(manifestsApplication)).toEqual([]);
	},
);

ruleStory.it(
	"manifests/application does not count a negated pattern as hoisting @shivaedev/*",
	[
		repositoryHas(...entryPointWorkspace, APP, {
			content: 'packages: [modules/*]\npublicHoistPattern:\n  - "*"\n  - "!@shivaedev/*"\n',
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ check }) {
		expect(yield* check(manifestsApplication)).toEqual([UNHOISTED]);
	},
);

for (const { entry, field, piece } of REPEATED_PIECES) {
	ruleStory.it(
		`manifests/application reports ${piece} that an application lists in ${field} beside ${entry}, which brings it`,
		[
			repositoryHas(
				...entryPointWorkspace,
				HOIST_WORKSPACE,
				application("modules/app/package.json", { ...platformApp, [field]: { ...platformApp[field], [piece]: "workspace:*" } }),
			),
		],
		function* ({ check }) {
			const findings = yield* check(manifestsApplication);

			expect(findings).toEqual([
				{
					file: "modules/app/package.json",
					message: `Lists "${piece}" in ${field} beside "${entry}", which already brings it. Remove "${piece}" from ${field} and keep importing it by its own name.`,
					subject: piece,
				},
			]);
		},
	);
}

ruleStory.it(
	"manifests/application lets a library declare its pieces directly without hoisting them",
	[
		repositoryHas(...entryPointWorkspace, PLAIN_WORKSPACE, {
			content: `${JSON.stringify({ dependencies: { "@shivaedev/sql": "workspace:*" }, devDependencies: { "@shivaedev/test": "workspace:*", "@shivaedev/test-story": "workspace:*" }, name: "@shivaedev/library" })}\n`,
			path: "modules/library/package.json",
		}),
	],
	function* ({ check }) {
		expect(yield* check(manifestsApplication)).toEqual([]);
	},
);
