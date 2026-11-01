import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { malformedSession, notesScreen, screens, signedOutNotesRoute } from "#modules/notes/test-support/screens.ts";

screens.it(
	"a signed-out visitor to the notes route lands on sign-in without reading notes or showing an error",
	[signedOutNotesRoute()],
	function* ({ alert, heading, notesReads, settle }) {
		yield* settle();

		yield* outcomes([
			["page", heading, "Sign in"],
			["alert", alert, "no alert"],
			["notes reads", notesReads, "no notes reads"],
		]);
	},
);

screens.it(
	"adding a note after alice's session expires asks her to sign in and keeps the draft",
	[notesScreen()],
	function* ({ alert, draft, enter, expireSession, settle, submit }) {
		yield* expireSession();
		yield* enter("Keep this draft");

		yield* submit();
		yield* settle();

		yield* outcomes([
			["alert", alert, "Sign in to add a note."],
			["draft", draft, "Keep this draft"],
		]);
	},
);

screens.it(
	"a refused sign-out says it failed after one sign-out request",
	[notesScreen("Could not sign out")],
	function* ({ alert, click, settle, signOutCalls }) {
		expect(yield* signOutCalls()).toBe("no sign-out requests");

		yield* click("Sign out");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Could not sign out. Try again."],
			["sign-out requests", signOutCalls, "one sign-out request"],
		]);
	},
);

screens.it("a malformed session shows the session check failure instead of the notes app", [malformedSession()], function* ({ addNoteForm, alert }) {
	yield* outcomes([
		["alert", alert, "Could not check your session."],
		["add-note form", addNoteForm, "hidden"],
	]);
});
