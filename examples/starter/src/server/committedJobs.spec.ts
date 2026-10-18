import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"refreshes live notes after the worker counts committed titles",
	[signedIn()],
	function* ({ actor, startWorker, liveNotes, storedNotes, waitPastWorkerPoll }) {
		const { notes: http } = actor();
		const live = yield* liveNotes();
		const note = yield* http.create({ title: "Count these three words" });
		expect(note.wordCount).toBeNull();
		yield* live.shows([note]);
		yield* waitPastWorkerPoll();
		expect(yield* storedNotes()).toEqual([expect.objectContaining(note)]);
		yield* startWorker();
		yield* live.shows([{ ...note, version: 1, wordCount: 4 }]);
		const second = yield* http.create({ title: "After commit" });
		yield* live.shows([
			{ ...second, version: 1, wordCount: 2 },
			{ ...note, version: 1, wordCount: 4 },
		]);
		expect(yield* storedNotes()).toEqual([
			expect.objectContaining({ ...note, version: 1, wordCount: 4 }),
			expect.objectContaining({ ...second, version: 1, wordCount: 2 }),
		]);
	},
	15_000,
);
