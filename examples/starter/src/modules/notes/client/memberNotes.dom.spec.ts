import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApp, signedInMembers } from "#modules/notes/test-support/app.tsx";

notesApp.it("alice's new note stays out of bob's refreshed list", [signedInMembers("alice", "bob")], function* ({ as }) {
	yield* outcomes([
		["alice's notes before", () => as("alice").savedNotes(), ["no notes yet"]],
		["bob's notes before", () => as("bob").savedNotes(), ["no notes yet"]],
	]);

	yield* as("alice").addsNote("Alice's private note");
	yield* as("bob").refreshes();

	yield* outcomes([
		["alice's notes", () => as("alice").savedNotes(), ["Alice's private note"]],
		["bob's notes", () => as("bob").savedNotes(), ["no notes yet"]],
	]);
});
