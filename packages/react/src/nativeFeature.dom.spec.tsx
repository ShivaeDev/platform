import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { emptyNotesShown, morningWalkSaved, nativeStory } from "#test/nativeStories.ts";

nativeStory.it("saving a note through the native RPC client refreshes the list to show it", [emptyNotesShown()], function* ({ click, listedTitles }) {
	expect(yield* listedTitles()).toEqual([]);

	yield* click("Save");

	expect(yield* listedTitles()).toEqual(["Morning walk"]);
});

nativeStory.it(
	"a save the server rejects shows its error, stores nothing and keeps the listed notes",
	[morningWalkSaved()],
	function* ({ click, listedTitles, saveError, storedNotes }) {
		expect(yield* saveError()).toBe("none");

		yield* click("Save empty");

		yield* outcomes({
			"listed titles": [listedTitles(), ["Morning walk"]],
			"save error": [saveError(), "shown"],
			"stored notes": [storedNotes(), [{ id: 1, title: "Morning walk" }]],
		});
	},
);
