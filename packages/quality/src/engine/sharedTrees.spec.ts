import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sharedTreesRun } from "#test/sharedTreesRun.ts";

sharedTreesRun.it(
	"the story program reuses the syntax rules' tree of a source, a type-checking rule parses its own before the shared trees exist, and the run drops them at its end",
	[],
	function* ({ runs, storyTree, treeAfterRun, typedTree }) {
		yield* runs();

		yield* outcomes([
			["tree the story program reads", () => storyTree(), "the syntax rules' tree"],
			["tree the type-checking rule reads", () => typedTree(), "a tree of its own"],
			["tree after the run", () => treeAfterRun(), "a new tree"],
		]);
	},
);
