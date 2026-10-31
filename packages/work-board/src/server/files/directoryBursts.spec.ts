import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

fileWatcherStory.it(
	"twelve reports of one folder are coalesced into one rescan that announces its edited, added and removed notes",
	[watchedFiles({ "notes/log.md": "# Before", "notes/removed.md": "# Removed" })],
	function* ({ editorRemoves, editorWrites, nextAnnouncedChange, rootRescans, watcherReports, watchesStarted }) {
		yield* editorWrites("notes/log.md", "# After");
		yield* editorWrites("notes/added.md", "# Added");
		yield* editorRemoves("notes/removed.md");

		yield* watcherReports(Array.from({ length: 12 }, () => "notes"));

		yield* outcomes({
			"announced change": [nextAnnouncedChange(), ["notes/added.md", "notes/log.md", "notes/removed.md"]],
			"root rescans": [rootRescans(), 1],
			"watches started": [watchesStarted(), ["."]],
		});
	},
);

const IGNORED = [".git", ".git/objects", "node_modules", "node_modules/dependency", "notes/.cache", "notes/node_modules"];

fileWatcherStory.it(
	"reports inside hidden and dependency folders are neither inspected nor rescanned, and only the edited note is announced",
	[watchedFiles({ ".git/state.md": "# Hidden", "node_modules/dependency/note.md": "# Dependency", "notes/log.md": "# Before" })],
	function* ({ editorWrites, inspectedAmong, nextAnnouncedChange, rootRescans, watcherReports }) {
		yield* editorWrites("notes/log.md", "# After");

		yield* watcherReports([...IGNORED, "notes/log.md"]);

		yield* outcomes({
			"announced change": [nextAnnouncedChange(), ["notes/log.md"]],
			"ignored paths inspected": [inspectedAmong(IGNORED), []],
			"root rescans": [rootRescans(), 0],
		});
	},
);

fileWatcherStory.it(
	"a removed folder reported alone announces every note it held",
	[watchedFiles({ "notes/log.md": "# Log", "notes/nested/plan.md": "# Plan" })],
	function* ({ editorRemoves, nextAnnouncedChange, watcherReports }) {
		yield* editorRemoves("notes");

		yield* watcherReports(["notes"]);

		expect(yield* nextAnnouncedChange()).toEqual(["notes/log.md", "notes/nested/plan.md"]);
	},
);
