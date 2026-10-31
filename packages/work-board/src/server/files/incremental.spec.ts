import { Order } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fileWatcherStory, watchedFiles } from "#test/fileWatcherStory.ts";

const NOTES = Array.from({ length: 300 }, (_, index) => `item-${index}.md`);
const watchedNotes = watchedFiles(Object.fromEntries(NOTES.map((path) => [path, "# Before"])));

fileWatcherStory.it(
	"300 edited notes, each reported twice, are announced in one change naming every note and advance the revision once",
	[watchedNotes],
	function* ({ editorWrites, nextAnnouncedChange, revisionsAdvanced, watcherReports }) {
		for (const path of NOTES) {
			yield* editorWrites(path, "# After");
		}

		yield* watcherReports(NOTES.flatMap((path) => [path, path]));

		yield* outcomes({
			"announced change": [nextAnnouncedChange(), [...NOTES].sort(Order.String)],
			"revisions advanced": [revisionsAdvanced(), 1],
		});
	},
);

fileWatcherStory.it(
	"three readers at once after 300 reported edits share one snapshot that read each note once and shows every edit",
	[watchedNotes],
	function* ({ distinctBodies, editorWrites, filesRead, nextAnnouncedChange, readersReadAtOnce, watcherReports }) {
		for (const path of NOTES) {
			yield* editorWrites(path, "# After");
		}
		yield* watcherReports(NOTES);
		yield* nextAnnouncedChange();

		const shared = yield* readersReadAtOnce(3);

		expect(shared).toBe("one shared snapshot");
		yield* outcomes({
			"distinct bodies": [distinctBodies(), ["# After"]],
			"files read": [filesRead(), [...NOTES].sort(Order.String)],
		});
	},
);

fileWatcherStory.it(
	"reports from socket preparation folders announce only the note and rescan nothing",
	[
		watchedFiles({
			".board.sock.starting/pending.md": "# Startup lock",
			".sABC123/pending.md": "# Socket preparation",
			"note.md": "# Notes",
		}),
	],
	function* ({ listedPaths, nextAnnouncedChange, revisionsAdvanced, rootRescans, watcherReports }) {
		expect(yield* listedPaths()).toEqual(["note.md"]);

		yield* watcherReports([".board.sock.starting", ".board.sock.starting/pending.md", ".sABC123", ".sABC123/pending.md", "note.md"]);

		yield* outcomes({
			"announced change": [nextAnnouncedChange(), ["note.md"]],
			"revisions advanced": [revisionsAdvanced(), 1],
			"root rescans": [rootRescans(), 0],
		});
	},
);
