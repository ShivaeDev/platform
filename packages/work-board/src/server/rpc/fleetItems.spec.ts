import { Effect } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { fleetReports } from "#test/storyTraits.ts";

boardStory.it(
	"a defect while indexing reaches a Fleet items read as a bare internal server error",
	[
		projectFiles({ "note.md": "# Note" }),
		fleetReports({ completed: [], items: [] }),
		boardFilesystem((fs) => ({ ...fs, readFileString: () => Effect.die(new Error("Unexpected index defect")) })),
	],
	function* ({ fleetItemsAnswer }) {
		expect(yield* fleetItemsAnswer()).toBe("internal server error");
	},
);
