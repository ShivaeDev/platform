import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"keeps the independently enqueued job when the caller rolls back its outer transaction",
	[signedIn()],
	function* ({ actor, createInRolledBackTransaction, storedNotes, wordCountJobs, startWorker }) {
		const { notes: http } = actor();
		const owner = yield* http.whoami();
		expect(yield* createInRolledBackTransaction("Rolled back", owner.id)).toBe("rollback");
		expect(yield* http.list()).toEqual([]);
		expect(yield* storedNotes()).not.toContainEqual(expect.objectContaining({ title: "Rolled back" }));
		expect(yield* wordCountJobs()).toEqual([{ retryCount: 0, state: "created" }]);
		yield* startWorker();
		yield* eventually(
			wordCountJobs().pipe(
				Effect.flatMap((jobs) =>
					Effect.try(() => {
						expect(jobs).not.toEqual([]);
						for (const job of jobs) {
							expect(job).toEqual({ retryCount: 0, state: "completed" });
						}
					}),
				),
			),
			{ interval: "50 millis", times: 160 },
		);
	},
);

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
