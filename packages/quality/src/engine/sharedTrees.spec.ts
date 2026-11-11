import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sharedTreesRun } from "#test/sharedTreesRun.ts";

sharedTreesRun.it(
	"the story program reuses the tree a story rule parses for a source, other rules parse their own, and the run drops the shared tree with the story program",
	[],
	function* ({ runs, storyTree, syntaxTree, treeAfterRun }) {
		yield* runs();

		yield* outcomes([
			["tree the story program reads", () => storyTree(), "the story rules' tree"],
			["tree a syntax rule reads", () => syntaxTree(), "a tree of its own"],
			["tree after the run", () => treeAfterRun(), "a new tree"],
		]);
	},
);
