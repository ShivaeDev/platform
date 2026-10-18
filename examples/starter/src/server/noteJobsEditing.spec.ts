import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"counts an edited title and rejects the pre-count edit",
	[signedIn()],
	function* ({ actor, startWorker, rejectsWith }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		yield* startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* eventually(client.get({ id: edited.id }).pipe(Effect.flatMap((note) => Effect.try(() => expect(note).toEqual(counted)))), {
			interval: "50 millis",
			times: 100,
		});
		yield* client.update({ ...edited, title: "Before counting" }).pipe(rejectsWith("Conflict"));
		expect(yield* client.list()).toEqual([counted]);
	},
	15_000,
);
