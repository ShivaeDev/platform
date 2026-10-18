import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"counts an edited title, rejects the pre-count edit and completes jobs for deleted notes",
	[signedIn()],
	function* ({ actor, startWorker, noteIs, rejectsWith, wordCountJobsComplete }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		const deleted = yield* client.create({ title: "Deleted before counting" });
		yield* client.delete({ id: deleted.id, version: deleted.version });
		yield* startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* noteIs(edited.id, counted);
		yield* client.update({ ...edited, title: "Before counting" }).pipe(rejectsWith("Conflict"));
		expect(yield* client.list()).toEqual([counted]);
		yield* wordCountJobsComplete(3);
	},
	15_000,
);
