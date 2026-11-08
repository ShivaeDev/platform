import { importsAliased } from "#rules/imports/aliased.ts";
import { aliasRepository } from "#test/aliasRepository.ts";
import { importStory, repositoryHas, repositoryHolds } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const REPAIRS = [
	[
		"through a package.json imports alias",
		"packages/app/src/feature/forms.ts",
		'"../lib/format.ts" is a relative import. Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.',
	],
	[
		"by the other workspace package's name",
		"packages/app/src/kit-user.ts",
		'"../../kit/src/button.ts" is a relative import. It reaches into the workspace package @demo/kit; import it by that name, through a path its package.json "exports" lists.',
	],
	[
		"by the installed package's name",
		"packages/app/src/vendor-user.ts",
		'"../../../node_modules/left-pad/index.js" is a relative import. It reaches into the installed package left-pad; import that package by its name.',
	],
];

importStory.it(
	"imports/aliased reports every relative import form, including same-folder modules, while accepting package aliases",
	[repositoryHolds(aliasRepository)],
	function* ({ check, sites }) {
		yield* check(importsAliased);

		yield* assertThat(yield* sites(), (actual) =>
			actual.toEqual([
				"packages/app/src/feature/described.js:1 ../lib/format.ts",
				"packages/app/src/feature/documented.ts:1 ../lib/format.ts",
				"packages/app/src/feature/escaped.ts:1 ../lib/format.ts",
				"packages/app/src/feature/escaped.ts:2 ../lib/side.ts",
				"packages/app/src/feature/forms.ts:1 ../lib/format.ts",
				"packages/app/src/feature/forms.ts:2 ../lib/side.ts",
				"packages/app/src/feature/forms.ts:3 ./local.ts",
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
			]),
		);
	},
);

for (const [repair, file, message] of REPAIRS) {
	importStory.it(
		`imports/aliased tells the author of ${file} to import ${repair}`,
		[repositoryHolds(aliasRepository)],
		function* ({ check, findings }) {
			yield* check(importsAliased);

			yield* assertThat(yield* findings(), (actual, expect) => actual.toContainEqual(expect.objectContaining({ file, line: 1, message })));
		},
	);
}

for (const specifier of ["./local.ts", "#local.ts"]) {
	importStory.it(
		`imports/aliased ${specifier.startsWith("#") ? "accepts a package alias" : "asks for a package alias for a same-folder import"}`,
		[
			repositoryHas(
				{ content: '{"name":"app","type":"module","imports":{"#*.ts":"./src/*.ts"}}', path: "package.json" },
				{ content: `import { local } from "${specifier}";\nexport const value = local;`, path: "src/main.ts" },
				{ content: "export const local = 1;", path: "src/local.ts" },
			),
		],
		function* ({ check, messages }) {
			yield* check(importsAliased);

			const expected = specifier.startsWith("#")
				? []
				: [
						'"./local.ts" is a relative import. Import it through a "#…" alias from the "imports" of its package.json, and declare one there if none fits.',
					];
			yield* assertThat(yield* messages(), (actual) => actual.toEqual(expected));
		},
	);
}

importStory.it(
	"imports/aliased accepts relative imports between root tool configs, which no alias reaches, and still reports one between src/ modules",
	[
		repositoryHas(
			{ content: '{"name":"app","type":"module","imports":{"#*.ts":"./src/*.ts"}}', path: "package.json" },
			{ content: "export default { test: {} };", path: "vitest.config.ts" },
			{ content: 'import base from "./vitest.config.ts";\nexport default base;', path: "vitest.coverage.config.ts" },
			{ content: 'import base from "./vitest.config.ts";\nexport default base;', path: "vitest.screens.config.ts" },
			{ content: 'import { local } from "./local.ts";\nexport const value = local;', path: "src/main.ts" },
			{ content: "export const local = 1;", path: "src/local.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(importsAliased);

		yield* assertThat(yield* sites(), (actual) => actual.toEqual(["src/main.ts:1 ./local.ts"]));
	},
);
