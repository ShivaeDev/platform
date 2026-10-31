import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fixtureTree } from "#test/fixtureTree.ts";
import { importStory, repositoryHolds, workspaceInstalled } from "#test/importStory.ts";

importStory.it(
	"the import graph resolves a tsconfig path, a package.json import, a workspace package's source export, a JSON file and require",
	[repositoryHolds(fixtureTree("resolution")), workspaceInstalled("@demo/shared", "packages/shared")],
	function* ({ importsOf, mapsImports, unresolvedImports }) {
		yield* mapsImports();

		yield* outcomes({
			"src/main.ts imports": [
				importsOf("src/main.ts"),
				["src/aliased.ts", "src/lib/imported.ts", "packages/shared/src/index.ts", "src/config.json", "src/required.cjs"],
			],
			"unresolved imports": [unresolvedImports(), []],
		});
	},
);
