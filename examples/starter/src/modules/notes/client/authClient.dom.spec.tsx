import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingSessionCheck, refusedAppSignOut, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"Retry after a failed session check asks the app's auth client again and shows sign-in",
	[failingSessionCheck()],
	function* ({ alert, authRequests, click, heading, recoverSessionCheck, settle }) {
		yield* settle();
		expect(yield* alert()).toBe("Could not check your session.");
		yield* recoverSessionCheck();

		yield* click("Retry");
		yield* settle();

		yield* outcomes([
			["page", heading, "Sign in"],
			["auth requests", authRequests, ["session.story.test/api/auth/get-session", "session.story.test/api/auth/get-session"]],
		]);
	},
);

screens.it(
	"sign-out goes through the app's auth client and shows its refusal",
	[refusedAppSignOut("Provider refused sign-out")],
	function* ({ alert, authRequests, click, settle, shownNotes }) {
		yield* settle();
		expect(yield* shownNotes()).toEqual(["no notes yet"]);

		yield* click("Sign out");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Could not sign out. Try again."],
			["auth requests", authRequests, ["actions.story.test/api/auth/get-session", "actions.story.test/api/auth/sign-out"]],
		]);
	},
);
