import { expect } from "vitest";
import { importsAliased } from "#rules/imports/aliased.ts";
import { aliasRepository } from "#test/aliasRepository.ts";
import { importStory, repositoryHolds } from "#test/importStory.ts";

const REPAIRS = [
	[
		"through a package.json imports alias",
		"packages/app/src/feature/forms.ts",
		'"../lib/format.ts" leaves its folder. Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.',
	],
	[
		"by the other workspace package's name",
		"packages/app/src/kit-user.ts",
		'"../../kit/src/button.ts" leaves its folder. It reaches into the workspace package @demo/kit; import it by that name, through a path its package.json "exports" lists.',
	],
	[
		"by the installed package's name",
		"packages/app/src/vendor-user.ts",
		'"../../../node_modules/left-pad/index.js" leaves its folder. It reaches into the installed package left-pad; import that package by its name.',
	],
];

importStory.it(
	"imports/aliased reports each relative import that leaves its folder, in every import form, and no import that stays inside it",
	[repositoryHolds(aliasRepository)],
	function* ({ check, sites }) {
		yield* check(importsAliased);

		expect(yield* sites()).toEqual([
			"packages/app/src/feature/described.js:1 ../lib/format.ts",
			"packages/app/src/feature/documented.ts:1 ../lib/format.ts",
			"packages/app/src/feature/escaped.ts:1 ../lib/format.ts",
			"packages/app/src/feature/escaped.ts:2 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:1 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:2 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:4 ./parts/deeper.ts",
			"packages/app/src/feature/forms.ts:5 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:6 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:7 ../lib/side.ts",
			"packages/app/src/feature/forms.ts:8 ../lib/format.ts",
			"packages/app/src/feature/forms.ts:9 ../lib/format.ts",
			"packages/app/src/feature/prose.ts:3 ../lib/format.ts",
			"packages/app/src/kit-user.ts:1 ../../kit/src/button.ts",
			"packages/app/src/lib/uses.ts:1 ./widgets",
			"packages/app/src/lib/uses.ts:2 ../ghost.ts",
			"packages/app/src/vendor-user.ts:1 ../../../node_modules/left-pad/index.js",
			"script/tasks/run.ts:1 ../lib/tool.ts",
		]);
	},
);

for (const [repair, file, message] of REPAIRS) {
	importStory.it(
		`imports/aliased tells the author of ${file} to import ${repair}`,
		[repositoryHolds(aliasRepository)],
		function* ({ check, findings }) {
			yield* check(importsAliased);

			expect(yield* findings()).toContainEqual(expect.objectContaining({ file, line: 1, message }));
		},
	);
}
