import { expect } from "vitest";
import { folderNames } from "#rules/files/folderNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const CONTENT = { content: ["content/"] };

ruleStory.it(
	"files/folder-names reports a package folder that is not named after its package",
	[repositoryHas({ content: '{ "name": "@demo/ui-kit" }', path: "packages/kit/package.json" }, { content: "", path: "packages/kit/src/kit.ts" })],
	function* ({ check, findings }) {
		yield* check(folderNames);

		expect(yield* findings()).toEqual([
			{ file: "packages/kit", message: 'The folder of the package @demo/ui-kit is named "ui-kit", in kebab-case after the package name.' },
		]);
	},
);

ruleStory.it(
	"files/folder-names reports a PascalCase folder that holds no main file of its name",
	[repositoryHas({ content: "", path: "src/Toolbar/button.tsx" })],
	function* ({ check, findings }) {
		yield* check(folderNames);

		expect(yield* findings()).toEqual([
			{
				file: "src/Toolbar",
				message:
					'"Toolbar" is PascalCase but holds no Toolbar.ts or Toolbar.tsx. A PascalCase folder is a module named after its main file: add that file, or name the folder in kebab-case.',
			},
		]);
	},
);

ruleStory.it(
	"files/folder-names reports a content folder that is not snake_case",
	[repositoryHas({ content: "{}", path: "content/Forest-Path/intro.json" })],
	function* ({ check, findings }) {
		yield* check(folderNames, CONTENT);

		expect(yield* findings()).toEqual([
			{ file: "content/Forest-Path", message: '"Forest-Path" holds content, so it is named in snake_case, such as forest_path/.' },
		]);
	},
);

ruleStory.it(
	"files/folder-names reports a folder of grouped files that is not kebab-case",
	[repositoryHas({ content: "", path: "src/testSupport/seed.ts" })],
	function* ({ check, findings }) {
		yield* check(folderNames);

		expect(yield* findings()).toEqual([
			{
				file: "src/testSupport",
				message:
					'"testSupport" groups files, so it is named in kebab-case, such as test-support/. A folder named after a file beside or inside it is a module and takes that file\'s name.',
			},
		]);
	},
);

const named = [
	["kebab-case folders of grouped files", [{ content: "", path: "src/routers/items/list.ts" }], undefined],
	["a PascalCase module folder that holds its main file", [{ content: "", path: "src/Panel/Panel.tsx" }], undefined],
	[
		"a PascalCase module folder beside its main file",
		[
			{ content: "", path: "src/Dialog.tsx" },
			{ content: "", path: "src/Dialog/parts.tsx" },
		],
		undefined,
	],
	["a snake_case content folder", [{ content: "{}", path: "content/forest_path/intro.json" }], CONTENT],
	["a dot folder such as .storybook", [{ content: "", path: ".storybook/main.ts" }], undefined],
	[
		"a package folder named after its scoped package",
		[
			{ content: '{ "name": "@demo/app" }', path: "packages/app/package.json" },
			{ content: "", path: "packages/app/src/app.ts" },
		],
		undefined,
	],
] as const;

for (const [folders, files, options] of named) {
	ruleStory.it(`files/folder-names accepts ${folders}`, [repositoryHas(...files)], function* ({ check }) {
		expect(yield* check(folderNames, options)).toEqual([]);
	});
}

ruleStory.it("files/folder-names refuses the unknown option folders and names it", [], function* ({ optionIssues }) {
	expect(yield* optionIssues<unknown>(folderNames, { folders: [] })).toEqual([expect.stringContaining("folders")]);
});
