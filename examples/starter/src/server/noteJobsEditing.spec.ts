import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"counts an edited title and rejects the pre-count edit",
	[signedIn()],
	function* ({ actor, startWorker, noteIs, rejectsWith }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		yield* startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* noteIs(edited.id, counted);
		yield* client.update({ ...edited, title: "Before counting" }).pipe(rejectsWith("Conflict"));
		expect(yield* client.list()).toEqual([counted]);
	},
	15_000,
);
