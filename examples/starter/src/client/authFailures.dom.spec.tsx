import { notesScreen, screens, signedOutNotesRoute } from "#test-support/screens.ts";

screens.it(
	"shows the protected route's typed Unauthorized failure and links to sign-in",
	[signedOutNotesRoute()],
	function* ({ alertSays, signInIsOffered, noteCallsAre }) {
		yield* alertSays("Sign in to view your notes.");
		yield* signInIsOffered();
		yield* noteCallsAre();
	},
);

screens.it(
	"shows typed command rejection after expiry without clearing the draft",
	[notesScreen()],
	function* ({ expireSession, enter, submit, alertSays, draftIs, noteCallsAre }) {
		yield* expireSession();
		yield* enter("Keep this draft");
		yield* submit();
		yield* alertSays("Sign in to add a note.");
		yield* draftIs("Keep this draft");
		yield* noteCallsAre("list");
	},
);

screens.it(
	"calls sign-out and shows a failed sign-out without claiming success",
	[notesScreen("Could not sign out")],
	function* ({ click, signOutCalledTimes, alertSays }) {
		yield* click("Sign out");
		yield* signOutCalledTimes(1);
		yield* alertSays("Could not sign out");
	},
);
