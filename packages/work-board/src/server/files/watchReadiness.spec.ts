import { expect } from "vitest";
import { fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";
import { aLinkedFolder, aSilentWatcher, sentinelWriteFails } from "#test/fileWatchingTraits.ts";

fileReadingStory.it(
	"starts watching once the real watcher reports its sentinel, publishes the next edit and leaves no sentinel in the workspace",
	[readableFiles({ "note.md": "# Note" })],
	function* ({ edited, publishedPaths, startWatching, watchStarted, workspaceEntries }) {
		yield* startWatching();
		yield* watchStarted();

		yield* edited("note.md", "# Edited");

		expect(yield* publishedPaths()).toEqual(["note.md"]);
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

for (const code of ["EACCES", "EPERM", "EROFS"]) {
	const failure = sentinelWriteFails(code);
	fileReadingStory.it(
		`publishes live edits and warns once for a root whose sentinel write fails with ${code}`,
		[readableFiles({ "note.md": "# Before" }), failure.trait],
		function* ({ edited, publishedPaths, root, startWatching, watchStarted }) {
			yield* startWatching();
			yield* watchStarted();

			yield* edited("note.md", "# After");

			expect(yield* publishedPaths()).toEqual(["note.md"]);
			yield* edited("note.md", "# Again");
			expect(yield* publishedPaths()).toEqual(["note.md"]);
			expect(failure.warnings()).toEqual([[`Cannot write the workspace watch sentinel in ${root}; trusting the watcher without confirmation.`]]);
		},
	);
}

const fullDisk = sentinelWriteFails("ENOSPC");
fileReadingStory.it(
	"fails a sentinel write on a full disk so the host can retry without trusting the watcher",
	[readableFiles({ "note.md": "# Note" }), fullDisk.trait],
	function* ({ startWatching, watchFailure }) {
		yield* startWatching();

		expect(yield* watchFailure()).toContain("ENOSPC");
		expect(fullDisk.warnings()).toEqual([]);
	},
);

const linked = aLinkedFolder();
const unwritableRoot = sentinelWriteFails("EACCES");
fileReadingStory.it(
	"warns only once for an unwritable root when a linked folder restarts its watcher",
	[readableFiles({ "note.md": "# Note" }), unwritableRoot.trait, linked.trait],
	function* ({ root, startWatching, watchStarted }) {
		yield* startWatching();
		yield* watchStarted();
		expect(unwritableRoot.warnings()).toEqual([[`Cannot write the workspace watch sentinel in ${root}; trusting the watcher without confirmation.`]]);

		yield* linked.link();
		yield* watchStarted();

		expect(unwritableRoot.warnings()).toEqual([[`Cannot write the workspace watch sentinel in ${root}; trusting the watcher without confirmation.`]]);
	},
);
