import { boardStartStory, startedProject } from "#test/boardStartStory.ts";

boardStartStory.it(
	"indexes the workspace as the board starts, before any reader asks for a page",
	[startedProject({ "index.md": "# Index\n", "plans/first.md": "# First\n", "plans/second.md": "# Second\n" })],
	function* ({ waitForReads }) {
		yield* waitForReads(["index.md", "plans/first.md", "plans/second.md"]);
	},
);
