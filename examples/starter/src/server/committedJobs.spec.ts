import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps jobs after an outer rollback and refreshes live notes after the worker counts committed titles",
	[signedIn()],
	function* ({
		actor,
		startWorker,
		liveNotes,
		createInRolledBackTransaction,
		wordCountJobsAre,
		storedNotesAre,
		wordCountJobsComplete,
		wordCountRemainsPending,
	}) {
		const { notes: http } = actor();
		const live = yield* liveNotes();
		const note = yield* http.create({ title: "Count these three words" });
		expect(note.wordCount).toBeNull();
		yield* live.shows([note]);
		yield* createInRolledBackTransaction();
		yield* wordCountJobsAre(2);
		yield* wordCountRemainsPending(note);
		yield* startWorker();
		yield* live.shows([{ ...note, version: 1, wordCount: 4 }]);
		const second = yield* http.create({ title: "After commit" });
		yield* live.shows([
			{ ...second, version: 1, wordCount: 2 },
			{ ...note, version: 1, wordCount: 4 },
		]);
		yield* wordCountJobsComplete(3);
		yield* storedNotesAre([
			{ ...note, version: 1, wordCount: 4 },
			{ ...second, version: 1, wordCount: 2 },
		]);
	},
	15_000,
);
