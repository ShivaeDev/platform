import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

const EXPECTED_WORKER_RUNS = 3;

app.it(
	"keeps jobs after an outer rollback and refreshes live notes after the worker counts committed titles",
	[signedIn()],
	function* ({ actor, collector, liveNotes, createInRolledBackTransaction, storedNotes, wordCountCompletions }) {
		const { notes: http } = actor();
		const live = yield* liveNotes();
		const note = yield* http.create({ title: "Count these three words" });
		expect(note.wordCount).toBeNull();
		yield* Effect.promise(() => expect.poll(live.notes, { timeout: 5000 }).toEqual([note]));
		const owner = yield* http.whoami();
		expect(yield* createInRolledBackTransaction("Rolled back", owner.id)).toMatchObject({ _tag: "Failure", failure: "rollback" });

		yield* Effect.sleep("1200 millis");
		expect(yield* http.get({ id: note.id })).toEqual(note);
		const receiver = yield* collector();
		const stopWorker = yield* receiver.startWorker();
		yield* Effect.promise(() => expect.poll(live.notes, { timeout: 5000 }).toEqual([{ ...note, version: 1, wordCount: 4 }]));
		const second = yield* http.create({ title: "After commit" });
		yield* Effect.promise(() =>
			expect.poll(live.notes, { timeout: 5000 }).toEqual([
				{ ...second, version: 1, wordCount: 2 },
				{ ...note, version: 1, wordCount: 4 },
			]),
		);
		yield* Effect.promise(() =>
			expect.poll(() => receiver.spans.filter((span) => span.name === "CountWords"), { timeout: 8000 }).toHaveLength(EXPECTED_WORKER_RUNS),
		);
		yield* Effect.promise(() =>
			expect
				.poll(() => Effect.runPromise(wordCountCompletions()), { timeout: 8000 })
				.toMatchObject([
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
				]),
		);
		yield* stopWorker;
		expect(receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code)).toEqual([1, 1, 1]);
		expect(yield* storedNotes()).toEqual(
			[
				{ ...note, version: 1, wordCount: 4 },
				{ ...second, version: 1, wordCount: 2 },
			].map((saved) => expect.objectContaining(saved)),
		);
	},
	15_000,
);
