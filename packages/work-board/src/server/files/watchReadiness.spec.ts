import { expect } from "vitest";
import { aSilentWatcher, fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";

fileReadingStory.it(
	"starts watching once the real watcher reports its sentinel, publishes the next edit and leaves no sentinel in the workspace",
	[readableFiles({ "note.md": "# Note" })],
	function* ({ edited, startWatching, watchStarted, workspaceEntries }) {
		yield* startWatching();
		yield* watchStarted();

		yield* edited("note.md", "# Edited");

		expect(workspaceEntries()).toEqual(["note.md"]);
	},
);

fileReadingStory.it(
	"fails the watch as unavailable and removes its sentinel when the watcher never reports it",
	[readableFiles({ "note.md": "# Note" }), aSilentWatcher()],
	function* ({ readinessWindowPasses, sentinelWritten, startWatching, watchFailure, workspaceEntries }) {
		yield* startWatching();
		yield* sentinelWritten();

		yield* readinessWindowPasses();

		expect(yield* watchFailure()).toBe(
			"unavailable: The workspace watcher did not report a change within 5 seconds. Retrying the watch automatically.",
		);
		expect(workspaceEntries()).toEqual(["note.md"]);
	},
	{ clock: "test" },
);

fileReadingStory.it(
	"removes its sentinel when the watch stops before the watcher reports it",
	[readableFiles({ "note.md": "# Note" }), aSilentWatcher()],
	function* ({ sentinelWritten, startWatching, stopWatching, workspaceEntries }) {
		yield* startWatching();
		yield* sentinelWritten();
		expect(workspaceEntries()).toEqual([expect.stringMatching(/^\.work-board-watch-/u), "note.md"]);

		yield* stopWatching();

		expect(workspaceEntries()).toEqual(["note.md"]);
	},
);
