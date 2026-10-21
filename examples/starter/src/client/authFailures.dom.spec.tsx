import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { notesScreen, screens, signedOutNotesRoute } from "#test-support/screens.ts";

const EXPECTED_SIGN_OUT_REQUESTS = 1;

screens.it(
	"shows the protected route's typed Unauthorized failure and links to sign-in",
	[signedOutNotesRoute()],
	function* ({ closeScreen, consoleErrors, alert, signInLink, form, noteCalls }) {
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Sign in to view your notes.")));
		yield* Effect.promise(() => eventually(() => expect(signInLink()).toBe("/sign-in")));
		expect(form()).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toEqual([])));
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
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Sign in to add a note.")));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("Keep this draft")));
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toEqual(["list"])));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);

screens.it(
	"calls sign-out and shows a failed sign-out without claiming success",
	[notesScreen("Could not sign out")],
	function* ({ closeScreen, consoleErrors, click, signOutCalls, alert }) {
		yield* click("Sign out");
		yield* Effect.promise(() => eventually(() => expect(signOutCalls()).toBe(EXPECTED_SIGN_OUT_REQUESTS)));
		yield* Effect.promise(() => eventually(() => expect(alert()).toBe("Could not sign out")));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
