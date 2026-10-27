import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { importsManifest } from "#rules/imports/manifest.ts";
import { application, entryPointWorkspace, HOIST_WORKSPACE, pieceImports, platformApp } from "#test/applicationFiles.ts";

const workspace = repositoryHas(...entryPointWorkspace, HOIST_WORKSPACE);

ruleKit.it(
	"an application imports the pieces its platform and test-story entry points bring by their own names",
	[workspace, repositoryHas(application("modules/app/package.json", platformApp), ...pieceImports)],
	function* ({ checks }) {
		expect(yield* checks(importsManifest)).toEqual([]);
	},
);

ruleKit.it(
	"test-story's pieces stay out of an application's runtime code",
	[workspace, repositoryHas(application("modules/app/package.json", platformApp))],
	function* ({ checks, writes }) {
		yield* writes({ content: 'import { story } from "@shivaedev/test/story.ts";\nexport const shipped = story;\n', path: "modules/app/src/app.ts" });
		expect((yield* checks(importsManifest)).map((finding) => [finding.file, finding.subject])).toEqual([
			["modules/app/src/app.ts", "@shivaedev/test"],
		]);
	},
);

ruleKit.it(
	"a library that tests with test-story still declares each piece it imports",
	[
		workspace,
		repositoryHas(
			{
				content: `${JSON.stringify({ devDependencies: { "@shivaedev/test-story": "workspace:*" }, name: "@shivaedev/library" })}\n`,
				path: "modules/app/package.json",
			},
			...pieceImports,
		),
	],
	function* ({ checks }) {
		expect((yield* checks(importsManifest)).map((finding) => finding.subject).toSorted()).toEqual(["@shivaedev/sql", "@shivaedev/test"]);
	},
);

ruleKit.it(
	"an application without the entry point that brings a piece is told which entry point to add",
	[workspace, repositoryHas(application("modules/app/package.json", { dependencies: platformApp.dependencies }), ...pieceImports)],
	function* ({ checks }) {
		const findings = yield* checks(importsManifest);
		expect(findings.map((finding) => finding.subject)).toEqual(["@shivaedev/test"]);
		expect(findings[0]?.message).toContain('An application can instead add "@shivaedev/test-story" to devDependencies, which brings it.');
	},
);
