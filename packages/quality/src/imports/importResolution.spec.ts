import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { conditionalWorkspace, legacyWorkspace } from "#test/compilerResolution.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importStory, repositoryHas, repositoryHolds, workspaceInstalled } from "#test/importStory.ts";

importStory.it(
	"the import graph resolves a tsconfig path, a package.json import, a workspace package's source export, a JSON file and require",
	[repositoryHolds(fixtureTree("resolution")), workspaceInstalled("@demo/shared", "packages/shared")],
	function* ({ importsOf, mapsImports, unresolvedImports }) {
		yield* mapsImports();

		yield* outcomes([
			[
				"src/main.ts imports",
				() => importsOf("src/main.ts"),
				["src/aliased.ts", "src/lib/imported.ts", "packages/shared/src/index.ts", "src/config.json", "src/required.cjs"],
			],
			["unresolved imports", () => unresolvedImports(), []],
		]);
	},
);

importStory.it(
	"the import graph uses inherited path aliases and NodeNext exports without enabling an undeclared source condition or exposing private paths",
	[repositoryHas(...conditionalWorkspace), workspaceInstalled("@demo/shared", "packages/shared")],
	function* ({ importsOf, mapsImports, unresolvedImports }) {
		yield* mapsImports();

		yield* outcomes([
			["ES module imports", () => importsOf("src/main.mts"), ["src/aliased.ts", "packages/shared/src/imported.mts"]],
			["CommonJS and dynamic imports", () => importsOf("src/main.cts"), ["packages/shared/src/required.cts", "packages/shared/src/imported.mts"]],
			["private exports", () => unresolvedImports(), ["@demo/shared/private"]],
		]);
	},
);

importStory.it(
	"the import graph uses the referenced project that includes a file to resolve its aliases and exports",
	[
		repositoryHas(...conditionalWorkspace),
		repositoryHas(
			{ content: '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}', path: "tsconfig.json" },
			{ content: '{"extends":"./compiler.json","include":["src"]}', path: "tsconfig.app.json" },
		),
		workspaceInstalled("@demo/shared", "packages/shared"),
	],
	function* ({ importsOf, mapsImports }) {
		yield* mapsImports();

		expect(yield* importsOf("src/main.mts")).toEqual(["src/aliased.ts", "packages/shared/src/imported.mts"]);
	},
);

importStory.it(
	"the import graph follows a Node10 project's package main instead of its exports",
	[repositoryHas(...legacyWorkspace), workspaceInstalled("@demo/shared", "packages/shared")],
	function* ({ importsOf, mapsImports, unresolvedImports }) {
		yield* mapsImports();

		yield* outcomes([
			["legacy package main", () => importsOf("src/main.ts"), ["packages/shared/src/legacy.js"]],
			["unresolved imports", () => unresolvedImports(), []],
		]);
	},
);
