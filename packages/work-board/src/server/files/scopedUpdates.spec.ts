import { expect } from "vitest";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

const ONE_LISTING = 1;

fileWatcherStory.it(
	"lists the workspace once while the watch starts and the first index reads it",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log" })],
	function* ({ readIndex, story }) {
		expect((yield* readIndex()).documents.map((indexed) => indexed.file)).toEqual(["index.md", "notes/log.md"]);
		expect(story.engine.scans).toBe(ONE_LISTING);
	},
);

fileWatcherStory.it(
	"rereads only the files a directory change touched",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log", "plans/first.md": "# First", "plans/second.md": "# Second" })],
	function* ({ readIndex, clearReads, writeFile, notify, nextChange, readPaths, story }) {
		yield* readIndex();
		clearReads();
		const scans = story.engine.scans;
		writeFile("notes/added/today.md", "# Today");
		yield* notify(["notes/added"]);
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: ["notes/added/today.md"] });
		expect((yield* readIndex()).documents.map((indexed) => indexed.file)).toContain("notes/added/today.md");
		expect(readPaths()).toEqual(["notes/added/today.md"]);
		expect(story.engine.scans).toBe(scans + ONE_LISTING);
	},
);
