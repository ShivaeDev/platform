import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn, workerExportsTraces } from "#modules/notes/test-support/application.ts";

app.it(
	"the worker counts alice's note and exports one successful CountWords span",
	[workerExportsTraces(), signedIn("alice")],
	function* ({ exportedSpans, notesOf, workerCountsQueuedNotes, workerStops }) {
		const note = yield* notesOf("alice").create("Count these words");

		yield* workerCountsQueuedNotes();
		yield* workerStops();

		yield* outcomes([
			["alice's note", () => notesOf("alice").open(note), { ...note, version: 1, wordCount: 3 }],
			["exported CountWords spans", () => exportedSpans("CountWords"), ["ok"]],
		]);
	},
	15_000,
);
