import { expect } from "vitest";
import { nativeNotes, nativeStory } from "#test/nativeStories.ts";

nativeStory.it(
	"rendered create persists through RPC and refreshes its query; rejected saves preserve the list",
	[nativeNotes()],
	function* ({ click, settled, persisted }) {
		yield* settled([]);
		yield* click("Save");
		yield* settled(["Morning walk"]);
		yield* click("Save empty");
		yield* settled(["Morning walk"], true);
		expect(yield* persisted()).toEqual([{ id: 1, title: "Morning walk" }]);
	},
);
