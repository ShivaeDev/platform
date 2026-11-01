import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"the worker's word count refreshes alice's open notes list",
	[signedIn("alice")],
	function* ({ notesOf, watchesNotes, workerCountsQueuedNotes }) {
		const note = yield* notesOf("alice").create("Count these four words");
		const aliceList = yield* watchesNotes("alice");
		expect(yield* aliceList.nextList()).toEqual([note]);

		yield* workerCountsQueuedNotes();

		expect(yield* aliceList.nextList()).toEqual([{ ...note, version: 1, wordCount: 4 }]);
	},
	15_000,
);
