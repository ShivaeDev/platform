import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";
import { aLinkedFolder, aReportedWatcher, aSilentWatcher, sentinelWriteFails } from "#test/fileWatchingTraits.ts";

fileReadingStory.it(
	"once the real watcher reports its sentinel the watch publishes the next edit and leaves no sentinel behind",
	[readableFiles({ "note.md": "# Note" })],
	function* ({ edited, publishedPaths, startWatching, watchStarted, workspaceEntries }) {
		yield* startWatching();
		yield* watchStarted();

		yield* edited("note.md", "# Edited");

		yield* outcomes([
			["published change", () => publishedPaths(), ["note.md"]],
			["workspace entries", () => workspaceEntries(), ["note.md"]],
		]);
	},
);

fileReadingStory.it(
	"a watcher that never reports the sentinel within 5 seconds fails the watch as unavailable and its sentinel is removed",
	[readableFiles({ "note.md": "# Note" }), aSilentWatcher()],
	function* ({ readinessWindowPasses, sentinelWritten, startWatching, watchFailure, workspaceEntries }) {
		yield* startWatching();
		yield* sentinelWritten();

		yield* readinessWindowPasses();

		yield* outcomes([
			[
				"the watch",
				() => watchFailure(),
				"unavailable: The workspace watcher did not report a change within 5 seconds. Retrying the watch automatically.",
			],
			["workspace entries", () => workspaceEntries(), ["note.md"]],
		]);
	},
	{ clock: "test" },
);

fileReadingStory.it(
	"stopping the watch before the watcher reports the sentinel removes the sentinel",
	[readableFiles({ "note.md": "# Note" }), aSilentWatcher()],
	function* ({ sentinelWritten, startWatching, stopWatching, workspaceEntries }) {
		yield* startWatching();
		yield* sentinelWritten();
		expect(yield* workspaceEntries()).toEqual(["a watch sentinel", "note.md"]);

		yield* stopWatching();

		expect(yield* workspaceEntries()).toEqual(["note.md"]);
	},
);

for (const code of ["EACCES", "EPERM", "EROFS"]) {
	fileReadingStory.it(
		`a root whose sentinel write fails with ${code} still publishes each live edit and warns once that it trusts the watcher`,
		[readableFiles({ "note.md": "# Before" }), sentinelWriteFails(code)],
		function* ({ edited, publishedPaths, root, sentinelWarnings, startWatching, watchStarted }) {
			yield* startWatching();
			yield* watchStarted();
			yield* edited("note.md", "# After");
			expect(yield* publishedPaths()).toEqual(["note.md"]);

			yield* edited("note.md", "# Again");

			yield* outcomes([
				["next published change", () => publishedPaths(), ["note.md"]],
				["warnings", () => sentinelWarnings(), [`Cannot write the workspace watch sentinel in ${root}; trusting the watcher without confirmation.`]],
			]);
		},
	);
}

fileReadingStory.it(
	"a sentinel write that fails on a full disk fails the watch without a warning, so the host retries instead of trusting the watcher",
	[readableFiles({ "note.md": "# Note" }), sentinelWriteFails("ENOSPC")],
	function* ({ sentinelWarnings, startWatching, watchFailure }) {
		yield* startWatching();

		yield* outcomes([
			["the watch", () => watchFailure(), expect.stringContaining("ENOSPC")],
			["warnings", () => sentinelWarnings(), []],
		]);
	},
);

fileReadingStory.it(
	"an unwritable root warns only once when linking a folder restarts its watcher",
	[readableFiles({ "note.md": "# Note" }), aReportedWatcher(), sentinelWriteFails("EACCES"), aLinkedFolder()],
	function* ({ linkFolder, root, sentinelWarnings, startWatching, watcherReports, watchStarted }) {
		const warning = `Cannot write the workspace watch sentinel in ${root}; trusting the watcher without confirmation.`;
		yield* startWatching();
		yield* watchStarted();
		expect(yield* sentinelWarnings()).toEqual([warning]);

		yield* linkFolder();
		yield* watcherReports("linked");
		yield* watchStarted();

		expect(yield* sentinelWarnings()).toEqual([warning]);
	},
);
