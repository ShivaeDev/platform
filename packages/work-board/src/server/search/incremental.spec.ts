import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { indexedQuestion } from "#test/indexedQuestion.ts";
import { indexedFiles, indexStory, unreadableAfterReport } from "#test/indexStory.ts";

const ALPHA = "---\nid: a\n---\n# Alpha";
const BETA = "---\nid: b\n---\n# Beta";
const threeNotes = indexedFiles({ "a.md": ALPHA, "b.md": BETA, "c.md": "# Gamma" });
const twoNotes = indexedFiles({ "a.md": ALPHA, "b.md": BETA });

indexStory.it(
	"a reported edit that keeps its old timestamp is the only file read again, and the other documents are kept without parsing",
	[threeNotes],
	function* ({ bodyOf, editorWritesKeepingTimestamp, filesRead, keptDocuments, watcherReports }) {
		yield* editorWritesKeepingTimestamp("a.md", "---\nid: a\n---\n# Changed");
		yield* watcherReports("a.md");

		yield* outcomes({
			"body of a.md": [bodyOf("a.md"), "# Changed"],
			"documents kept": [keptDocuments(), ["b.md", "c.md"]],
			"files read": [filesRead(), ["a.md"]],
		});
	},
);

indexStory.it(
	"a reported new file is the only file the index reads",
	[threeNotes],
	function* ({ editorAdds, filesRead, indexedPaths, watcherReports }) {
		yield* editorAdds("added.md", "# Added");
		yield* watcherReports("added.md");

		yield* outcomes({
			"files read": [filesRead(), ["added.md"]],
			"indexed paths": [indexedPaths(), ["a.md", "added.md", "b.md", "c.md"]],
		});
	},
);

indexStory.it(
	"a reported removal drops the record without reading any file",
	[threeNotes],
	function* ({ editorRemoves, filesRead, indexedIds, watcherReports }) {
		expect(yield* indexedIds()).toEqual(["a", "b"]);

		yield* editorRemoves("b.md");
		yield* watcherReports("b.md");

		yield* outcomes({
			"files read": [filesRead(), []],
			"indexed identities": [indexedIds(), ["a"]],
		});
	},
);

indexStory.it(
	"a reported move reads only the moved file and leaves the index equal to a fresh scan",
	[threeNotes],
	function* ({ editorMoves, filesRead, indexDifferences, watcherReports }) {
		yield* editorMoves("a.md", "moved.md");
		yield* watcherReports("a.md", "moved.md");

		yield* outcomes({
			"differences from a fresh scan": [indexDifferences(), []],
			"files read": [filesRead(), ["moved.md"]],
		});
	},
);

indexStory.it(
	"the full check catches an edit that kept its old timestamp without parsing the unchanged file again",
	[twoNotes],
	function* ({ editorWritesKeepingTimestamp, fullCheckRuns, indexDifferences, keptDocuments }) {
		yield* editorWritesKeepingTimestamp("a.md", "---\nid: a\n---\n# Changed");
		yield* fullCheckRuns();

		yield* outcomes({
			"differences from a fresh scan": [indexDifferences(), []],
			"documents kept": [keptDocuments(), ["b.md"]],
		});
	},
);

indexStory.it(
	"a reported file that cannot be read is listed as unavailable and the index still equals a fresh scan",
	[twoNotes],
	function* ({ indexDifferences, readingDenied, unavailableFiles, watcherReports }) {
		expect(yield* unavailableFiles()).toEqual([]);

		yield* readingDenied("a.md");
		yield* watcherReports("a.md");

		yield* outcomes({
			"differences from a fresh scan": [indexDifferences(), []],
			"unavailable files": [unavailableFiles(), ["a.md"]],
		});
	},
);

indexStory.it(
	"an unavailable file is read again on the next read once it can be read",
	[twoNotes, unreadableAfterReport("a.md")],
	function* ({ filesRead, indexDifferences, readingRecovers, unavailableFiles }) {
		expect(yield* unavailableFiles()).toEqual(["a.md"]);

		yield* readingRecovers();

		yield* outcomes({
			"differences from a fresh scan": [indexDifferences(), []],
			"files read": [filesRead(), ["a.md"]],
			"unavailable files": [unavailableFiles(), []],
		});
	},
);

indexStory.it("with the watcher stopped, a read shows an edit nobody reported", [twoNotes], function* ({ bodyOf, editorWrites, watcherStops }) {
	expect(yield* bodyOf("b.md")).toBe("# Beta");

	yield* watcherStops();
	yield* editorWrites("b.md", "# Offline edit");

	expect(yield* bodyOf("b.md")).toBe("# Offline edit");
});

const QUESTIONS = { "a.md": indexedQuestion("a"), "b.md": indexedQuestion("b") };
const questionsAged = indexedFiles(
	QUESTIONS,
	new Map([
		["a.md", 1000],
		["b.md", 2000],
	]),
);

indexStory.it(
	"a reported edit with a newer modification time moves the question in Inbox and search order and records the new time",
	[questionsAged],
	function* ({ editorWritesAt, inboxOrder, modifiedAt, searchOrder, watcherReports }) {
		yield* outcomes({
			"Inbox order": [inboxOrder(), ["a", "b"]],
			"search order": [searchOrder("question"), ["b", "a"]],
		});

		yield* editorWritesAt("a.md", `${QUESTIONS["a.md"]}\nChanged context`, 10);
		yield* watcherReports("a.md");

		yield* outcomes({
			"Inbox order": [inboxOrder(), ["b", "a"]],
			"modification time of a.md": [modifiedAt("a.md"), 10_000],
			"search order": [searchOrder("question"), ["a", "b"]],
		});
	},
);

for (const [noticed, notice] of [
	["the watcher reports it", "watcherReports"],
	["the full check runs", "fullCheckRuns"],
] as const) {
	indexStory.it(
		`when ${noticed}, a new timestamp without new bytes reorders Inbox and search while the parsed document is kept`,
		[questionsAged],
		function* (index) {
			yield* outcomes({
				"Inbox order": [index.inboxOrder(), ["a", "b"]],
				"search order": [index.searchOrder("question"), ["b", "a"]],
			});

			yield* index.editorStamps("a.md", 3 * 86_400);
			yield* notice === "watcherReports" ? index.watcherReports("a.md") : index.fullCheckRuns();

			yield* outcomes({
				"documents kept": [index.keptDocuments(), ["a.md", "b.md"]],
				"Inbox order": [index.inboxOrder(), ["b", "a"]],
				"search order": [index.searchOrder("question"), ["a", "b"]],
			});
		},
	);
}
