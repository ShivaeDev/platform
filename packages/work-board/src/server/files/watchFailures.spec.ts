import { expect } from "vitest";
import { fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";
import { anEndedWatcher } from "#test/fileWatchingTraits.ts";

fileReadingStory.it(
	"a watcher that ends early fails the watch as unavailable so the host retries it",
	[readableFiles({ "note.md": "# Note" }), anEndedWatcher()],
	function* ({ watchUntilItEnds }) {
		expect(yield* watchUntilItEnds()).toBe("unavailable: The workspace watcher ended. Retrying the watch automatically.");
	},
);
