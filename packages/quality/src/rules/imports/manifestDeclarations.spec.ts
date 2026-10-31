import { expect } from "vitest";
import { importsManifest } from "#rules/imports/manifest.ts";
import { importStory, repositoryHas, repositoryHolds, workspaceInstalled } from "#test/importStory.ts";
import { manifestTree } from "#test/manifestTree.ts";

const SHIPPED = { content: 'import "plain-kit";', path: "modules/app/src/app.ts" };

const DEVELOPMENT_PATHS = [
	"modules/app/config.mjs",
	"modules/app/script/check.ts",
	"modules/app/scripts/check.ts",
	"modules/app/src/app.dom.spec.tsx",
	"modules/app/src/app.test.ts",
	"modules/app/src/app.typecheck.test.ts",
	"modules/app/src/test-support/fixture.ts",
	"modules/app/tooling/check.ts",
	"modules/app/vitest.config.ts",
];

const DEVELOPMENT = repositoryHas(...DEVELOPMENT_PATHS.map((path) => ({ content: SHIPPED.content, path })));

const FORMS = [
	'import "plain-kit/index.ts";',
	'import "#kit";',
	'import "../../kit/src/index.ts";',
	'import "../../kit/generated/missing.ts";',
	'export { kit } from "plain-kit";',
	'const kit = import("plain-kit");',
	'const required = require("plain-kit");',
	'type Kit = typeof import("plain-kit");',
	'import "other-external";',
	'import "@acme/app";',
].join("\n");

for (const workspace of ["npm", "pnpm"] as const) {
	importStory.it(
		`imports/manifest reports undeclared scoped and unscoped workspace imports in a ${workspace} workspace without any fence`,
		[repositoryHolds(manifestTree({ workspace })), repositoryHas(SHIPPED, { content: 'import "@acme/app";', path: "modules/kit/src/app.ts" })],
		function* ({ check, sites }) {
			yield* check(importsManifest);

			expect(yield* sites()).toEqual(["modules/app/src/app.ts:1 plain-kit", "modules/kit/src/app.ts:1 @acme/app"]);
		},
	);
}

importStory.it(
	"imports/manifest asks to declare an undeclared workspace import or remove it",
	[repositoryHolds(manifestTree()), repositoryHas(SHIPPED)],
	function* ({ check, messages }) {
		yield* check(importsManifest);

		expect(yield* messages()).toEqual([
			expect.stringContaining("Add it to dependencies, peerDependencies or optionalDependencies, or remove the import."),
		]);
	},
);

importStory.it(
	"imports/manifest names a workspace package by its literal scope, @types included, and without an import query",
	[
		repositoryHolds(manifestTree()),
		repositoryHas(
			{ content: '{"name":"@types/shapes"}', path: "modules/shapes/package.json" },
			{ content: 'import type {} from "@types/shapes/subpath";\nimport "plain-kit?raw";', path: SHIPPED.path },
		),
	],
	function* ({ check, subjects }) {
		yield* check(importsManifest);

		expect(yield* subjects()).toEqual(["@types/shapes", "plain-kit"]);
	},
);

for (const declaration of ["dependencies", "peerDependencies", "optionalDependencies"]) {
	importStory.it(
		`imports/manifest accepts a workspace import declared in ${declaration} from shipped code`,
		[repositoryHolds(manifestTree({ declaration })), repositoryHas(SHIPPED)],
		function* ({ check }) {
			expect(yield* check(importsManifest)).toEqual([]);
		},
	);
}

importStory.it(
	"imports/manifest accepts devDependencies only in tests, test support and tooling, at the workspace root too, and reports them in shipped code",
	[
		repositoryHolds(manifestTree({ declaration: "devDependencies" })),
		DEVELOPMENT,
		repositoryHas(
			SHIPPED,
			{ content: 'import type { kit } from "plain-kit";', path: "modules/app/src/types.ts" },
			{ content: SHIPPED.content, path: "modules/app/src/scripts/shipped.ts" },
			{ content: SHIPPED.content, path: "modules/app/src/runtime.config.ts" },
			{ content: '{"name":"root","devDependencies":{"plain-kit":"workspace:*"}}', path: "package.json" },
			{ content: SHIPPED.content, path: "script/check.ts" },
			{ content: SHIPPED.content, path: "src/main.ts" },
		),
	],
	function* ({ check, files }) {
		yield* check(importsManifest);

		expect(yield* files()).toEqual([
			SHIPPED.path,
			"modules/app/src/runtime.config.ts",
			"modules/app/src/scripts/shipped.ts",
			"modules/app/src/types.ts",
			"src/main.ts",
		]);
	},
);

importStory.it(
	"imports/manifest reports an undeclared workspace import in tests, test support and tooling too",
	[repositoryHolds(manifestTree()), DEVELOPMENT],
	function* ({ check, files }) {
		yield* check(importsManifest);

		expect(yield* files()).toEqual(DEVELOPMENT_PATHS);
	},
);

importStory.it(
	"imports/manifest sees subpaths, resolved aliases, relative and missing paths, dynamic imports, re-exports, require and type queries, and no external package",
	[repositoryHolds(manifestTree()), repositoryHas({ content: FORMS, path: SHIPPED.path }), workspaceInstalled("plain-kit", "modules/kit")],
	function* ({ check, locations }) {
		yield* check(importsManifest);

		expect(yield* locations()).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((line) => `${SHIPPED.path}:${line}`));
	},
);

importStory.it(
	"imports/manifest keeps a module under a nested manifest outside the workspace inside the member that holds it",
	[
		repositoryHolds(manifestTree()),
		repositoryHas(
			{ content: '{"name":"@acme/nested","dependencies":{"plain-kit":"workspace:*"}}', path: "modules/app/src/nested/package.json" },
			{ ...SHIPPED, path: "modules/app/src/nested/app.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(importsManifest);

		expect(yield* locations()).toEqual(["modules/app/src/nested/app.ts:1"]);
	},
);

importStory.it(
	"imports/manifest refuses a member manifest whose dependencies it cannot read",
	[repositoryHolds(manifestTree()), repositoryHas(SHIPPED, { content: '{"name":"@acme/app","dependencies":[]}', path: "modules/app/package.json" })],
	function* ({ refusal }) {
		expect(yield* refusal(importsManifest)).toContain("Invalid package manifest");
	},
);
