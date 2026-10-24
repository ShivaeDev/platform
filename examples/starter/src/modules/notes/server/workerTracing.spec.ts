import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"counts a title and exports the word-count worker's application span",
	[signedIn()],
	function* ({ actor, collector }) {
		const receiver = yield* collector();
		const note = yield* actor().notes.create({ title: "Count these words" });
		const stopWorker = yield* receiver.startWorker();
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(actor().notes.get({ id: note.id })), { timeout: 8000 }).toEqual({ ...note, version: 1, wordCount: 3 }),
		);
		yield* stopWorker;
		expect(receiver.spans.some((span) => span.name === "CountWords")).toBe(true);
	},
	15_000,
);
