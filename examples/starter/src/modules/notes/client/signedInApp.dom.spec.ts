import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { signedInApp } from "#modules/notes/test-support/signedInApp.ts";

signedInApp.it("alice opens her notes signed in with the app's cookie session", [], function* ({ heading, settle, shownNotes }) {
	yield* settle();

	yield* outcomes([
		["page", heading, "Notes"],
		["notes", shownNotes, ["no notes yet"]],
	]);
});

signedInApp.it(
	"alice sees her own pushed note without seeing bob's private note",
	[],
	function* ({ bobAddsNote, click, enter, shownNotes, settle, waitsForHint }) {
		yield* settle();
		const hints = yield* waitsForHint();
		yield* bobAddsNote("Private note");
		yield* enter("Shopping");

		yield* click("Add note");
		yield* hints.next;
		yield* settle();

		yield* outcomes([["alice’s notes", shownNotes, ["Shopping"]]]);
	},
);
