import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { responsesFolderOpen } from "#test/publicationTraits.ts";

boardStory.it(
	"a writer whose open responses/ was moved away refuses to publish and leaves the moved folder as it was",
	[deferredServing, projectFiles({ "responses/existing.md": "Existing feedback" }, "responses/ holds existing feedback"), responsesFolderOpen()],
	function* ({ folderEntries, moveFile, publishIntoOpenFolder }) {
		moveFile("responses", "moved");

		yield* outcomes({
			"moved folder": [folderEntries("moved"), ["existing.md"]],
			publication: [publishIntoOpenFolder("response.edge", "New feedback"), "conflict: The write boundary changed."],
		});
	},
);
