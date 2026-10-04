import { describe, expect, it } from "vitest";
import { folderNames } from "#rules/files/folderNames.ts";
import { checkRule, issuesOf } from "#test/support/inputs.ts";

const files = [
	"packages/app/package.json",
	"packages/app/src/routers/items/list.ts",
	"packages/app/src/Panel/Panel.tsx",
	"packages/app/src/Toolbar/button.tsx",
	"packages/app/src/Dialog.tsx",
	"packages/app/src/Dialog/parts.tsx",
	"packages/app/src/testSupport/seed.ts",
	"packages/app/src/generated/Client/client.ts",
	"packages/app/content/forest_path/intro.json",
	"packages/app/content/Forest-Path/intro.json",
	"packages/app/.storybook/main.ts",
	"packages/kit/package.json",
	"packages/kit/src/index.ts",
];

const texts = { "packages/app/package.json": '{ "name": "@demo/app" }', "packages/kit/package.json": '{ "name": "@demo/ui-kit" }' };

describe("files/folder-names", () => {
	it("flags a package folder, a PascalCase folder without its main file, a content folder and a group folder named against the scheme", async () => {
		const findings = await checkRule(folderNames, { content: ["packages/app/content/"] }, { files, texts });
		expect(findings.map((finding) => finding.file)).toEqual([
			"packages/app/content/Forest-Path",
			"packages/app/src/Toolbar",
			"packages/app/src/testSupport",
			"packages/kit",
		]);
	});

	it("names the expected shape in each message", async () => {
		const findings = await checkRule(folderNames, { content: ["packages/app/content/"] }, { files, texts });
		expect(findings.map((finding) => finding.message)).toEqual([
			'"Forest-Path" holds content, so it is named in snake_case, such as forest_path/.',
			'"Toolbar" is PascalCase but holds no Toolbar.ts or Toolbar.tsx. A PascalCase folder is a module named after its main file: add that file, or name the folder in kebab-case.',
			'"testSupport" groups files, so it is named in kebab-case, such as test-support/. A folder named after a file beside or inside it is a module and takes that file\'s name.',
			'The folder of the package @demo/ui-kit is named "ui-kit", in kebab-case after the package name.',
		]);
	});

	it("rejects options it does not know", async () => {
		expect(await issuesOf(folderNames, { folders: [] })).not.toEqual([]);
	});
});
