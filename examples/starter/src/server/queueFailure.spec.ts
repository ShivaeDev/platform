import { expect } from "vitest";
import { app, rejectedNoteCommits, rejectedNoteJobs, signedIn } from "#test-support/application.ts";

app.it("saves and edits notes when PostgreSQL rejects enqueueing", [signedIn(), rejectedNoteJobs()], function* ({ actor, storedNotes }) {
	const { notes } = actor();
	const created = yield* notes.create({ title: "Still saved" });
	const edited = yield* notes.update({ ...created, title: "Still edited" });
	expect(yield* notes.get({ id: created.id })).toEqual(edited);
	expect(yield* storedNotes()).toEqual([expect.objectContaining({ id: created.id, title: "Still edited", version: 1, wordCount: null })]);
});

app.it(
	"does not enqueue a note when its write transaction fails at commit",
	[signedIn(), rejectedNoteCommits()],
	function* ({ actor, rejectsWith, storedNotes, wordCountJobs }) {
		yield* actor().notes.create({ title: "Not committed" }).pipe(rejectsWith("ServiceUnavailable"));
		expect(yield* storedNotes()).toEqual([]);
		expect(yield* wordCountJobs()).toEqual([]);
	},
);
