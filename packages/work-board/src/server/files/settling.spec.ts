import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

fileWatcherStory.it(
	"a read during an observed edit waits for the edit to settle and then shows it instead of the cached snapshot",
	[watchedFiles({ "note.md": "# Before" })],
	function* ({ editorWrites, readerStartsReading, statPausesFor, statResumes, waitingReader, waitingReaderBody, watcherReportsWhilePaused }) {
		yield* statPausesFor("note.md");
		yield* editorWrites("note.md", "# After");
		yield* watcherReportsWhilePaused(["note.md"]);
		yield* readerStartsReading();
		expect(yield* waitingReader()).toBe("still waiting");

		yield* statResumes();

		expect(yield* waitingReaderBody("note.md")).toBe("# After");
	},
);
