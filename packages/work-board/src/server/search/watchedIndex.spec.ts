import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { indexedBriefs, watchedIndexStory } from "#test/watchedIndexStory.ts";

const BRIEF = "---\nid: brief\nkind: task\n---\n# Before";
const briefs = indexedBriefs({ "brief.md": BRIEF, "unchanged.md": "# Unchanged" });

watchedIndexStory.it(
	"a reported edit to a brief updates its body and announces one change after reading only that brief",
	[briefs],
	function* ({ announcedChanges, bodyOf, editorChanges, filesRead, foldersScanned, watcherReports }) {
		expect(yield* bodyOf("brief.md")).toBe("# Before");

		yield* editorChanges("brief.md", BRIEF.replace("Before", "After"));
		yield* watcherReports("brief.md");

		yield* outcomes([
			["announced changes", () => announcedChanges(), [["brief.md"]]],
			["body of brief.md", () => bodyOf("brief.md"), "# After"],
			["files read", () => filesRead(), ["brief.md"]],
			["folders scanned", () => foldersScanned(), []],
		]);
	},
);

watchedIndexStory.it(
	"a reported new brief is indexed under its identity and announced once, without scanning the folder",
	[briefs],
	function* ({ announcedChanges, editorAdds, filesRead, filesWithIdentity, foldersScanned, watcherReports }) {
		expect(yield* filesWithIdentity("added")).toEqual([]);

		yield* editorAdds("added.md", "---\nid: added\n---\n# Added");
		yield* watcherReports("added.md");

		yield* outcomes([
			["announced changes", () => announcedChanges(), [["added.md"]]],
			["files read", () => filesRead(), ["added.md"]],
			["files under added", () => filesWithIdentity("added"), ["added.md"]],
			["folders scanned", () => foldersScanned(), []],
		]);
	},
);

watchedIndexStory.it(
	"a reported move indexes the brief at its new path after reading only that path, and announces one change for both paths",
	[briefs],
	function* ({ announcedChanges, editorMoves, filesRead, filesWithIdentity, watcherReports }) {
		expect(yield* filesWithIdentity("brief")).toEqual(["brief.md"]);

		yield* editorMoves("brief.md", "moved.md");
		yield* watcherReports("brief.md", "moved.md");

		yield* outcomes([
			["announced changes", () => announcedChanges(), [["brief.md", "moved.md"]]],
			["files read", () => filesRead(), ["moved.md"]],
			["files under brief", () => filesWithIdentity("brief"), ["moved.md"]],
		]);
	},
);

watchedIndexStory.it(
	"a reported deletion removes the brief's identity and announces one change without reading any file",
	[briefs],
	function* ({ announcedChanges, editorDeletes, filesRead, filesWithIdentity, watcherReports }) {
		expect(yield* filesWithIdentity("brief")).toEqual(["brief.md"]);

		yield* editorDeletes("brief.md");
		yield* watcherReports("brief.md");

		yield* outcomes([
			["announced changes", () => announcedChanges(), [["brief.md"]]],
			["files read", () => filesRead(), []],
			["files under brief", () => filesWithIdentity("brief"), []],
		]);
	},
);

watchedIndexStory.it(
	"the full check repairs and announces an edit the watcher missed, even with its timestamp preserved",
	[briefs],
	function* ({ announcedChanges, bodyOf, editorChanges, fullCheckRuns }) {
		expect(yield* bodyOf("brief.md")).toBe("# Before");

		yield* editorChanges("brief.md", BRIEF.replace("Before", "Missed"));
		yield* fullCheckRuns();

		yield* outcomes([
			["announced changes", () => announcedChanges(), [["brief.md"]]],
			["body of brief.md", () => bodyOf("brief.md"), "# Missed"],
		]);
	},
);

watchedIndexStory.it(
	"reading the index again after startup returns the startup snapshot without touching any file or folder",
	[briefs],
	function* ({ filesChecked, filesRead, foldersScanned, readerReadsAgain }) {
		const read = yield* readerReadsAgain();

		expect(read).toBe("the startup snapshot");
		yield* outcomes([
			["files checked", () => filesChecked(), []],
			["files read", () => filesRead(), []],
			["folders scanned", () => foldersScanned(), []],
		]);
	},
);

watchedIndexStory.it(
	"a reconciliation with unchanged document bytes and timestamps announces no changes",
	[indexedBriefs({ "brief.md": "# Brief" })],
	function* ({ announcementsWaiting, bodyOf, fullCheckRuns }) {
		expect(yield* bodyOf("brief.md")).toBe("# Brief");

		yield* fullCheckRuns();

		expect(yield* announcementsWaiting()).toBe(0);
	},
);
