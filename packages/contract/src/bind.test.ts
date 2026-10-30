import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveConnectionOpen, notesStory, watching } from "#test/notesStory.ts";

notesStory.it(
	"renaming note 1 refreshes note 1 and the list and leaves note 2 unread",
	[watching("note 1", "note 2", "the list")],
	function* ({ rename, serverReads, shown, timesRead }) {
		expect(yield* serverReads()).toEqual(["get:1", "get:2", "list"]);

		yield* rename(1, "Uno");

		yield* outcomes({
			"note 1": [shown("note 1"), "Uno"],
			"note 2's reads": [timesRead("note 2"), "read once"],
			"the list": [shown("the list"), ["Uno", "Two"]],
		});
	},
);

notesStory.it(
	"renaming note 2 to a blank title is rejected as an invalid title and refreshes neither note 2 nor the list",
	[watching("note 2", "the list")],
	function* ({ rename, timesRead }) {
		expect(yield* rename(2, "")).toBe("failed with invalid title: Enter a title");

		yield* outcomes({
			"note 2's reads": [timesRead("note 2"), "read once"],
			"the list's reads": [timesRead("the list"), "read once"],
		});
	},
);

notesStory.it("creating the note Three refreshes the watched note 3 that was missing", [watching("note 3")], function* ({ create, shown }) {
	expect(yield* shown("note 3")).toBe("failed with note 3 is missing");

	yield* create("Three");

	expect(yield* shown("note 3")).toBe("Three");
});

notesStory.it(
	"a prepared note 1 neither reads nor subscribes until it is mounted, and then subscribes to its changes and reads it once",
	[liveConnectionOpen()],
	function* ({ mount, prepare, serverReads, shown, subscriptions }) {
		prepare("note 1");
		yield* outcomes({
			"reads before mounting": [serverReads(), []],
			"subscriptions before mounting": [subscriptions(), []],
		});

		mount("note 1");

		yield* outcomes({
			"note 1": [shown("note 1"), "One"],
			reads: [serverReads(), ["get:1"]],
			subscriptions: [subscriptions(), [{ payload: { id: 1 }, query: "get" }]],
		});
	},
);
