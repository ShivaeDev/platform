import { folderNames } from "#rules/files/folderNames.ts";
import { APP, fileRoutedApp, ROUTE_CONTENT } from "#test/fileRoutedApp.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const [name, files, folder, options] of [
	["a nested source folder", [{ content: "", path: "src/server/internal/receive.ts" }], "src/server/internal", undefined],
	["a test-support folder", [{ content: "", path: "src/test-support/internal/fixture.ts" }], "src/test-support/internal", undefined],
	["a module folder", [{ content: "", path: "src/internal/internal.ts" }], "src/internal", undefined],
	["a package folder", [{ content: '{"name":"@demo/internal"}', path: "packages/internal/package.json" }], "packages/internal", undefined],
	[
		"a content folder",
		[{ content: "{}", path: "content/internal/page.json" }],
		"content/internal",
		{ content: [{ glob: "content/", reason: "Content uses its own identifiers." }] },
	],
	[
		"a tool-owned folder",
		[{ content: "", path: "src/internal/worker.ts" }],
		"src/internal",
		{ toolOwned: [{ glob: "src/internal/", reason: "The tool chooses these names." }] },
	],
] as const) {
	ruleStory.it(`files/folder-names rejects internal as ${name}`, [repositoryHas(...files)], function* ({ check, findings }) {
		yield* check(folderNames, options);

		yield* assertThat(yield* findings(), (actual) =>
			actual.toEqual([
				{
					file: folder,
					message:
						'A folder named "internal" implies privacy that export maps do not enforce. Move its files into the parent folder or a folder named after their job.',
				},
			]),
		);
	});
}

ruleStory.it(
	"files/folder-names rejects internal even in a configured route folder",
	[fileRoutedApp("{}", "src/routes"), repositoryHas({ content: ROUTE_CONTENT, path: `${APP}/src/routes/internal/index.tsx` })],
	function* ({ check, locations }) {
		yield* check(folderNames);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${APP}/src/routes/internal`]));
	},
);

ruleStory.it(
	"files/folder-names accepts job names that contain internal and a file named internal",
	[
		repositoryHas(
			{ content: "", path: "src/internal-tools/worker.ts" },
			{ content: "", path: "src/internals/worker.ts" },
			{ content: "", path: "src/internal.ts" },
		),
	],
	function* ({ check, findings }) {
		yield* check(folderNames);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);
