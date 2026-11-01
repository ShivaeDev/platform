import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceAccount, authScreen, notesApp, signInResponseHeld } from "#modules/notes/test-support/app.tsx";

notesApp.it(
	"Sign in says Please wait and stays disabled while the app's sign-in response is pending",
	[aliceAccount(), signInResponseHeld(), authScreen()],
	function* ({ settle, signInButton, signsIn }) {
		yield* settle();
		expect(yield* signInButton()).toBe("Sign in, enabled");

		yield* signsIn("incorrect-password");

		expect(yield* signInButton()).toBe("Please wait…, disabled");
	},
);

notesApp.it(
	"a wrong password shows the app host's rejection and enables Sign in again",
	[aliceAccount(), authScreen()],
	function* ({ alert, heading, settle, signInButton, signsIn }) {
		yield* settle();

		yield* signsIn("incorrect-password");
		yield* settle();

		yield* outcomes([
			["alert", alert, "Invalid email or password"],
			["Sign in button", signInButton, "Sign in, enabled"],
			["page", heading, "Sign in"],
		]);
	},
);
