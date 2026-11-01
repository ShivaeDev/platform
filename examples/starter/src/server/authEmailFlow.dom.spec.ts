import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authEmailApp } from "#test-support/authEmailApp.tsx";

authEmailApp.it("alice's confirmation email links to the app's confirm route", [], function* ({ deliveredEmails, requestsConfirmation }) {
	yield* requestsConfirmation();

	expect(yield* deliveredEmails()).toEqual(["confirm account for alice@app.test at http://127.0.0.1:5173/auth/confirm"]);
});

authEmailApp.it(
	"following alice's confirmation link verifies her account and lands on sign-in",
	[],
	function* ({ account, followsConfirmationLink, requestsConfirmation }) {
		yield* requestsConfirmation();
		expect(yield* account()).toBe("unverified");

		const landing = yield* followsConfirmationLink();

		yield* outcomes([
			["landing page", () => Effect.succeed(landing), "/sign-in"],
			["alice's account", account, "verified"],
		]);
	},
);

authEmailApp.it("alice's password reset email links to the app's reset screen", [], function* ({ deliveredEmails, requestsPasswordReset }) {
	yield* requestsPasswordReset();

	expect(yield* deliveredEmails()).toEqual(["reset password for alice@app.test at http://127.0.0.1:5173/reset-password"]);
});

authEmailApp.it(
	"alice changes her password on the screen her reset link opens and signs in with it",
	[],
	function* ({ changesPassword, opensResetLink, requestsPasswordReset, screenStatus, signsIn }) {
		yield* requestsPasswordReset();
		yield* opensResetLink();
		expect(yield* signsIn("alice-replacement-password")).toBe("refused: Invalid email or password");

		yield* changesPassword("alice-replacement-password");

		yield* outcomes([
			["reset screen", screenStatus, "Password changed. Sign in"],
			["sign-in with the new password", () => signsIn("alice-replacement-password"), "signed in as alice@app.test"],
		]);
	},
);
