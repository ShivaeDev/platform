import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bobAccount, bobResetEmail, bobSessions, passwordResets, waitingReset } from "#test/better-auth/passwordReset.ts";

passwordResets.it(
	"bob's reset runs the native callback before the application Effect using bob's request service",
	[bobAccount, bobResetEmail],
	function* ({ recordedResetHooks, resetPassword }) {
		expect(yield* recordedResetHooks()).toEqual([]);

		const response = yield* resetPassword("bob");

		yield* outcomes([
			["reset response", () => Effect.succeed(response), { status: 200 }],
			["recorded reset hooks", () => recordedResetHooks(), ["native bob", "effect bob"]],
		]);
	},
);

for (const direct of [false, true]) {
	passwordResets.it(
		`bob's ${direct ? "direct reset with the mount's service" : "HTTP reset with alice's request service"} refuses a failing callback but changes his password and keeps his previous sessions revoked`,
		[bobAccount, bobSessions, bobResetEmail],
		function* ({ existingSession, resetPassword, signIn, storedSessions }) {
			yield* outcomes([
				["current password sign-in", () => signIn("bob", "current"), { status: 200 }],
				["browser session before reset", () => existingSession("browser"), "bob"],
				["phone session before reset", () => existingSession("phone"), "bob"],
			]);

			const response = yield* resetPassword("bob", "alice", direct);

			yield* outcomes([
				["reset refusal", () => Effect.succeed(response), { code: "MEMBERS_ONLY", message: "Membership is required", status: 403 }],
				["stored sessions after refusal", () => storedSessions(), []],
				["browser session after refusal", () => existingSession("browser"), "signed out"],
				["phone session after refusal", () => existingSession("phone"), "signed out"],
				["old password sign-in", () => signIn("bob", "current"), { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }],
				["new password sign-in", () => signIn("bob", "replacement"), { status: 200 }],
				["browser session after new sign-in", () => existingSession("browser"), "signed out"],
				["phone session after new sign-in", () => existingSession("phone"), "signed out"],
			]);
		},
	);
}

passwordResets.it(
	"cancelling a reset interrupts the application's waiting Effect",
	[bobAccount, bobResetEmail, waitingReset],
	function* ({ cancelReset, hookInterrupted }) {
		yield* cancelReset("bob");

		expect(yield* hookInterrupted()).toBe("interrupted");
	},
);
