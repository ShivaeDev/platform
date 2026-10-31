import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { malformedSession, notesScreen, screens, signedOutNotesRoute } from "#modules/notes/test-support/screens.ts";

screens.it(
	"redirects a signed-out notes visitor before querying notes or rendering a route failure",
	[signedOutNotesRoute()],
	function* ({ closeScreen, consoleErrors, heading, alert, reads }) {
		yield* eventually(() => expect(heading()).toBe("Sign in"));
		expect(alert()).toBeUndefined();
		expect(reads()).toEqual([]);
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows typed command rejection after expiry without clearing the draft",
	[notesScreen()],
	function* ({ closeScreen, consoleErrors, expireSession, enter, submit, alert, draft }) {
		yield* expireSession();
		yield* enter("Keep this draft");
		yield* submit();
		yield* eventually(() => expect(alert()).toBe("Sign in to add a note."));
		yield* eventually(() => expect(draft()).toBe("Keep this draft"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"calls sign-out and shows a failed sign-out without claiming success",
	[notesScreen("Could not sign out")],
	function* ({ closeScreen, consoleErrors, click, signOutCalls, alert }) {
		yield* click("Sign out");
		yield* eventually(() => expect(signOutCalls()).toEqual([undefined]));
		yield* eventually(() => expect(alert()).toBe("Could not sign out. Try again."));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"shows the session error branch for a malformed session payload",
	[malformedSession()],
	function* ({ alert, closeScreen, consoleErrors, form }) {
		expect(alert()).toBe("Could not check your session.");
		expect(form()).toBeNull();

		yield* closeScreen();

		expect(consoleErrors()).toEqual([]);
	},
);
