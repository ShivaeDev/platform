import { expect } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { application, entryPointWorkspace, HOIST_WORKSPACE, pieceImports, platformApp } from "#test/applicationFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const WORKSPACE = repositoryHas(...entryPointWorkspace, HOIST_WORKSPACE);

ruleStory.it(
	"imports/manifest lets an application import the pieces its platform and test-story entry points bring by their own names",
	[WORKSPACE, repositoryHas(application("modules/app/package.json", platformApp), ...pieceImports)],
	function* ({ check }) {
		expect(yield* check(importsManifest)).toEqual([]);
	},
);

ruleStory.it(
	"imports/manifest keeps test-story's pieces out of an application's runtime code",
	[
		WORKSPACE,
		repositoryHas(application("modules/app/package.json", platformApp), {
			content: 'import { story } from "@shivaedev/test/story.ts";\nexport const shipped = story;\n',
			path: "modules/app/src/app.ts",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(importsManifest);

		expect(findings).toEqual([expect.objectContaining({ file: "modules/app/src/app.ts", subject: "@shivaedev/test" })]);
	},
);

ruleStory.it(
	"imports/manifest requires a library that tests with test-story to declare each piece it imports",
	[
		WORKSPACE,
		repositoryHas(
			{
				content: `${JSON.stringify({ devDependencies: { "@shivaedev/test-story": "workspace:*" }, name: "@shivaedev/library" })}\n`,
				path: "modules/app/package.json",
			},
			...pieceImports,
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsManifest);

		expect(findings.map((finding) => finding.subject).toSorted()).toEqual(["@shivaedev/sql", "@shivaedev/test"]);
	},
);

ruleStory.it(
	"imports/manifest tells an application without the entry point that brings a piece which entry point to add",
	[WORKSPACE, repositoryHas(application("modules/app/package.json", { dependencies: platformApp.dependencies }), ...pieceImports)],
	function* ({ check }) {
		const findings = yield* check(importsManifest);

		expect(findings).toEqual([
			expect.objectContaining({
				message: expect.stringContaining('An application can instead add "@shivaedev/test-story" to devDependencies, which brings it.'),
				subject: "@shivaedev/test",
			}),
		]);
	},
);
