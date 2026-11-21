import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApp, signedInMembers } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"bob's refreshed list reads the note written for him past the app and leaves out alice's new note",
	[signedInMembers("alice", "bob")],
	function* ({ as, noteWrittenPastTheApp }) {
		yield* outcomes([
			["alice's notes before", () => as("alice").savedNotes(), ["no notes yet"]],
			["bob's notes before", () => as("bob").savedNotes(), ["no notes yet"]],
		]);
		yield* as("alice").addsNote("Alice's private note");
		yield* noteWrittenPastTheApp("bob", "Bob's imported note");

		yield* as("bob").refreshes();

		yield* outcomes([
			["alice's notes", () => as("alice").savedNotes(), ["Alice's private note"]],
			["bob's notes", () => as("bob").savedNotes(), ["Bob's imported note"]],
		]);
	},
);
