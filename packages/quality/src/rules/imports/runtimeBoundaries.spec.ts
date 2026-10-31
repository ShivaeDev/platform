import { expect } from "vitest";
import { fence } from "#imports/fence.ts";
import { external, folders, modules } from "#imports/fences/selectors.ts";
import { importFences } from "#rules/imports/fences.ts";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { emptyFolders, importStory, repositoryHas, workspaceInstalled } from "#test/importStory.ts";

const BROWSER_FENCE = fence("legacy-browser-stays-off-disk")
	.because("The existing browser code needs no Node.")
	.from(folders("src/browser"))
	.mayNotImport(modules("node:fs"))
	.demonstratedBy({ illegal: ["src/browser/app.ts", external("node:fs")], legal: ["src/browser/app.ts", external("effect")] });

const LEGACY_BROWSER = { content: 'import "node:fs";', path: "src/browser/app.ts" };

const MEMBERS = { content: '{"workspaces":["modules/*"]}', path: "package.json" };

importStory.it(
	"imports/runtime reports client code that imports server code and shared code that imports either runtime, through type imports, re-exports and missing targets too",
	[
		repositoryHas(
			{ content: 'import "../server/db.ts";\nimport type { Db } from "../server/missing.ts";', path: "src/client/app.ts" },
			{ content: 'export { db } from "./server/db.ts";\nexport * from "./client/app.ts";', path: "src/shared.ts" },
			{ content: "export const db = 1;", path: "src/server/db.ts" },
		),
	],
	function* ({ check, sites }) {
		yield* check(importsRuntime);

		expect(yield* sites()).toEqual([
			"src/client/app.ts:1 ../server/db.ts",
			"src/client/app.ts:2 ../server/missing.ts",
			"src/shared.ts:1 ./server/db.ts",
			"src/shared.ts:2 ./client/app.ts",
		]);
	},
);

importStory.it(
	"imports/runtime accepts imports within one runtime and either runtime importing shared code",
	[
		repositoryHas(
			{ content: 'import "./view.ts";\nimport "../values.ts";\nwindow.alert("hi");', path: "src/client/app.ts" },
			{ content: "export const view = 1;", path: "src/client/view.ts" },
			{ content: 'import "./db.ts";\nimport "../values.ts";\nimport "node:fs";', path: "src/server/app.ts" },
			{ content: "export const db = 1;", path: "src/server/db.ts" },
			{ content: "export const value = 1;", path: "src/values.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(importsRuntime)).toEqual([]);
	},
);

for (const specifier of ["node:fs", "fs/promises", "node:async_hooks"]) {
	importStory.it(
		`imports/runtime reports the Node builtin ${specifier} in client code and in shared code, however shared code loads it`,
		[
			repositoryHas(
				{ content: `import "${specifier}";`, path: "src/client/app.ts" },
				{ content: `export const load = () => import("${specifier}");`, path: "lib/load.ts" },
				{ content: `const fs = require("${specifier}");`, path: "src/load.ts" },
			),
		],
		function* ({ check, locations }) {
			yield* check(importsRuntime);

			expect(yield* locations()).toEqual(["lib/load.ts:1", "src/client/app.ts:1", "src/load.ts:1"]);
		},
	);
}

importStory.it(
	"imports/runtime checks only the workspace member that has a runtime folder, even an empty one",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"app"}', path: "modules/app/package.json" },
			{ content: '{"name":"legacy"}', path: "modules/legacy/package.json" },
			{ content: 'import "node:fs";\nwindow.alert("hi");', path: "modules/app/src/shared.ts" },
			{ content: 'import "node:fs";\nwindow.alert("hi");', path: "modules/legacy/src/app.ts" },
			{ content: 'import "node:fs";', path: "script/task.ts" },
		),
		emptyFolders("modules/app/src/server"),
	],
	function* ({ check, sites }) {
		yield* check(importsRuntime);

		expect(yield* sites()).toEqual(["modules/app/src/shared.ts:1 node:fs", "modules/app/src/shared.ts:2 window"]);
	},
);

importStory.it(
	"imports/runtime follows a package.json alias into another member's server code when only the importing member is checked",
	[
		repositoryHas(
			MEMBERS,
			{ content: '{"name":"app","imports":{"#db":"service/db.ts"}}', path: "modules/app/package.json" },
			{ content: '{"name":"service","exports":{"./db.ts":"./src/server/db.ts"}}', path: "modules/service/package.json" },
			{ content: 'import "#db";', path: "modules/app/src/client/app.ts" },
			{ content: "export const db = 1;", path: "modules/service/src/server/db.ts" },
		),
		workspaceInstalled("service", "modules/service"),
	],
	function* ({ checkOnly, sites }) {
		yield* checkOnly(importsRuntime, "modules/app/");

		expect(yield* sites()).toEqual(["modules/app/src/client/app.ts:1 #db"]);
	},
);

importStory.it(
	"imports/runtime starts checking a package once it gains a runtime folder",
	[repositoryHas(LEGACY_BROWSER)],
	function* ({ check, locations, writes }) {
		expect(yield* check(importsRuntime)).toEqual([]);

		yield* writes({ content: "export const view = 1;", path: "src/client/view.ts" });

		yield* check(importsRuntime);
		expect(yield* locations()).toEqual(["src/browser/app.ts:1"]);
	},
);

for (const [shape, setup] of [
	["without runtime folders", [repositoryHas(LEGACY_BROWSER)]],
	["with a runtime folder", [repositoryHas(LEGACY_BROWSER), emptyFolders("src/client")]],
] as const) {
	importStory.it(`imports/fences keeps an explicit fence in a package ${shape}`, setup, function* ({ check, locations }) {
		yield* check(importFences, { fences: [BROWSER_FENCE] });

		expect(yield* locations()).toEqual(["src/browser/app.ts:1"]);
	});
}

importStory.it(
	"imports/runtime leaves test files and test support outside the shipped runtime policy",
	[
		repositoryHas(
			{ content: "export const app = 1;", path: "src/client/app.ts" },
			{ content: 'import "node:fs";\ndocument.title = "test";\nimport "./client/app.ts";', path: "src/app.test.ts" },
			{ content: 'import "node:fs";\nwindow.alert("test");', path: "src/test-support/setup.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(importsRuntime)).toEqual([]);
	},
);
