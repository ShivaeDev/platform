import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"refreshes the owner's open list after the worker counts a committed title",
	[signedIn()],
	function* ({ actor, liveNotes, startWorker }) {
		const note = yield* actor().notes.create({ title: "Count these four words" });
		const live = yield* liveNotes();
		expect(yield* live.nextNotes()).toEqual([note]);

		yield* startWorker();

		expect(yield* live.nextNotes()).toEqual([{ ...note, version: 1, wordCount: 4 }]);
	},
	15_000,
);
