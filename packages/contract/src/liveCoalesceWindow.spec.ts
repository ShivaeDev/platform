import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { connected, liveNotesStory, watching } from "#test/liveNotesStory.ts";

liveNotesStory.it(
	"an announced edit re-reads note 1 and the list once, each after the default 20 ms window closes",
	[watching("note 1", "the list"), connected()],
	function* ({ edit, reReadDelay, shown, timesRead, windowCloses }) {
		yield* edit(1, "Changed");
		yield* windowCloses("note 1", "the list");

		yield* outcomes({
			"note 1": [shown("note 1"), "Changed"],
			"note 1's re-read": [reReadDelay("note 1"), "once the 20 ms window closed"],
			"note 1's reads": [timesRead("note 1"), "read 3 times"],
			"the list's re-read": [reReadDelay("the list"), "once the 20 ms window closed"],
			"the list's reads": [timesRead("the list"), "read 3 times"],
		});
	},
);
