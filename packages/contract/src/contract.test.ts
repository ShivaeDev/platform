import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { denied, liveNotesStory } from "#test/liveNotesStory.ts";

liveNotesStory.it("reading note 1 over HTTP answers with note 1 decoded as a Note", [], function* ({ get }) {
	expect(yield* get(1)).toBe("note 1 titled One: First");
});

liveNotesStory.it("reading the missing note 9 over HTTP fails with its declared note missing rejection", [], function* ({ get }) {
	expect(yield* get(9)).toBe("failed with note 9 is missing");
});

liveNotesStory.it("renaming note 1 to a blank title over HTTP fails with its declared invalid title rejection", [], function* ({ rename }) {
	expect(yield* rename(1, " ")).toBe("failed with invalid title: Enter a title");
});

liveNotesStory.it("creating the note Three over HTTP answers with the new note 3", [], function* ({ create }) {
	expect(yield* create("Three")).toBe("created note 3 titled Three");
});

liveNotesStory.it(
	"when the guard denies the session, reading note 1 over HTTP fails with denied and the server reads nothing",
	[denied()],
	function* ({ get, serverReads }) {
		yield* outcomes({
			"server reads": [serverReads(), []],
			"the read": [get(1), "failed with denied"],
		});
	},
);
