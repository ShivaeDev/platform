import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/contract/errors/taxonomy.ts";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { notesScreen, screens, signedOutNotesRoute } from "#modules/notes/test-support/screens.ts";

screens.it(
	"shows the protected route's typed Unauthorized failure and links to sign-in",
	[signedOutNotesRoute()],
	function* ({ closeScreen, consoleErrors, alert, signInLink, form, noteCalls }) {
		yield* eventually(() => expect(alert()).toBe("Sign in to view your notes."));
		yield* eventually(() => expect(signInLink()).toBe("/sign-in"));
		expect(form()).toBeNull();
		yield* eventually(() => expect(noteCalls()).toEqual([]));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([
			[
				expect.any(String),
				new Unauthorized({ message: "Authentication required" }),
				"The above error occurred in the <MatchInnerImpl> component.",
				"React will try to recreate this component tree from scratch using the error boundary you provided, CatchBoundary.",
			],
		]);
	},
);

screens.it(
	"shows typed command rejection after expiry without clearing the draft",
	[notesScreen()],
	function* ({ closeScreen, consoleErrors, expireSession, enter, submit, alert, draft, noteCalls }) {
		yield* expireSession();
		yield* enter("Keep this draft");
		yield* submit();
		yield* eventually(() => expect(alert()).toBe("Sign in to add a note."));
		yield* eventually(() => expect(draft()).toBe("Keep this draft"));
		yield* eventually(() => expect(noteCalls()).toEqual(["list"]));
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
		yield* eventually(() => expect(alert()).toBe("Could not sign out"));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
