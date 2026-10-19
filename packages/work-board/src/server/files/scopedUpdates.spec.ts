import { realpathSync } from "node:fs";
import { join } from "node:path";
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
	"lists only the reported folder and rereads only the file written into it",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log", "plans/first.md": "# First", "plans/second.md": "# Second" })],
	function* ({ readIndex, clearReads, writeFile, notify, nextChange, readPaths, story }) {
		yield* readIndex();
		clearReads();
		const listed = story.engine.folders.length;
		writeFile("notes/today.md", "# Today");
		yield* notify(["notes/today.md", "notes"]);
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: ["notes/today.md"] });
		expect((yield* readIndex()).documents.map((indexed) => indexed.file)).toContain("notes/today.md");
		expect(readPaths()).toEqual(["notes/today.md"]);
		expect(story.engine.folders.slice(listed)).toEqual(["notes"]);
	},
);

fileWatcherStory.it(
	"rereads only the reported file when the watch reports absolute paths",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log" })],
	function* ({ readIndex, clearReads, writeFile, notify, nextChange, readPaths, story }) {
		yield* readIndex();
		clearReads();
		writeFile("notes/log.md", "# Log\n\nUpdated.");
		yield* notify([join(realpathSync(story.engine.notes.root), "notes/log.md")]);
		expect(yield* nextChange()).toMatchObject({ _tag: "Changed", paths: ["notes/log.md"] });
		yield* readIndex();
		expect(readPaths()).toEqual(["notes/log.md"]);
	},
);
