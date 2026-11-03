import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failingSessionCheck, refusedAppSignOut, screens, signedInApp } from "#modules/notes/test-support/screens.ts";

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

screens.it("an unavailable session refresh keeps the signed-in app and its draft", [signedInApp()], function* (story) {
	yield* story.settle();
	expect(yield* story.heading()).toBe("Notes");
	yield* story.enter("Keep this draft");
	yield* story.failSessionCheck();

	const outcome = yield* story.refreshSessionOutcome();

	yield* outcomes([
		["session outcome", () => Effect.succeed(outcome), "UNAVAILABLE"],
		["signed-in page", story.heading, "Notes"],
		["draft", story.draft, "Keep this draft"],
		["session error replacement", story.alert, "no alert"],
	]);
});
