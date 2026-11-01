import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("alice's open notes list receives her new note", [signedIn("alice")], function* ({ notesOf, watchesNotes }) {
	const aliceList = yield* watchesNotes("alice");
	expect(yield* aliceList.nextList()).toEqual([]);

	const note = yield* notesOf("alice").create("Alice's note");

	expect(yield* aliceList.nextList()).toEqual([note]);
});

app.it(
	"alice's new note sends bob no change hint, so his next hint is about his own note",
	[signedIn("alice"), signedIn("bob")],
	function* ({ listensForChangeHints, notesOf }) {
		const bobHints = yield* listensForChangeHints("bob");

		yield* notesOf("alice").create("Alice's private note");

		yield* notesOf("bob").create("Bob's checkpoint note");
		expect(yield* bobHints.nextHint()).toBe("changed bob's notes");
	},
	15_000,
);

app.it("alice's open note refreshes after she edits its title", [signedIn("alice")], function* ({ notesOf, watchesNote }) {
	const note = yield* notesOf("alice").create("Original title");
	const aliceNote = yield* watchesNote("alice", note);
	expect(yield* aliceNote.nextNote()).toEqual(note);

	const edited = yield* notesOf("alice").edit(note, "Changed title");

	expect(yield* aliceNote.nextNote()).toEqual(edited);
});

app.it(
	"alice's open note answers service unavailable when PostgreSQL loses its connection",
	[signedIn("alice")],
	function* ({ noteReadsLoseTheDatabase, notesOf, watchesNote }) {
		const note = yield* notesOf("alice").create("Alice's note");
		const aliceNote = yield* watchesNote("alice", note);
		expect(yield* aliceNote.nextNote()).toEqual(note);
		yield* noteReadsLoseTheDatabase();

		yield* aliceNote.refresh();

		expect(yield* aliceNote.nextNote()).toBe("service unavailable: Could not reach the notes database");
	},
);
