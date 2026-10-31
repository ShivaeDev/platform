import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

fileWatcherStory.it(
	"starting the watch and the first index read list each folder once",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log" })],
	function* ({ foldersListed, indexedPaths }) {
		yield* outcomes([
			["folders listed", () => foldersListed(), ["", "notes"]],
			["indexed paths", () => indexedPaths(), ["index.md", "notes/log.md"]],
		]);
	},
);

fileWatcherStory.it(
	"a note written into a reported folder is indexed after listing only that folder and reading only that note",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log", "plans/first.md": "# First", "plans/second.md": "# Second" })],
	function* ({ editorWrites, filesRead, foldersListed, indexedPaths, nextAnnouncedChange, watcherReports }) {
		yield* editorWrites("notes/today.md", "# Today");

		yield* watcherReports(["notes/today.md", "notes"]);

		yield* outcomes([
			["announced change", () => nextAnnouncedChange(), ["notes/today.md"]],
			["files read", () => filesRead(), ["notes/today.md"]],
			["folders listed", () => foldersListed(), ["notes"]],
			["indexed paths", () => indexedPaths(), expect.arrayContaining(["notes/today.md"])],
		]);
	},
);

fileWatcherStory.it(
	"a note reported by its absolute real path is announced and read again alone",
	[watchedFiles({ "index.md": "# Index", "notes/log.md": "# Log" })],
	function* ({ editorWrites, filesRead, nextAnnouncedChange, watcherReportsAbsolute }) {
		yield* editorWrites("notes/log.md", "# Log\n\nUpdated.");

		yield* watcherReportsAbsolute("notes/log.md");

		yield* outcomes([
			["announced change", () => nextAnnouncedChange(), ["notes/log.md"]],
			["files read", () => filesRead(), ["notes/log.md"]],
		]);
	},
);
