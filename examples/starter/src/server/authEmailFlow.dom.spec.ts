import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authEmailApp } from "#test-support/authEmailApp.tsx";

authEmailApp.it(
	"alice's confirmation email is delivered once and its app route confirms her account",
	[],
	function* ({ request, messages, followConfirmation, confirmation, session }) {
		expect(yield* session()).toMatchObject({ user: { emailVerified: false } });
		yield* request("ConfirmAccount");

		yield* request("ConfirmAccount");

		expect(yield* messages()).toMatchObject([
			{ _tag: "ConfirmAccount", url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:5173\/auth\/confirm\?token=.+/u) },
		]);
		yield* followConfirmation();

		yield* outcomes([
			["confirmation response", confirmation, { location: "/sign-in", status: HttpStatus.fromLiteral("Found") }],
			["verified account", session, { user: { emailVerified: true } }],
		]);
	},
);

authEmailApp.it(
	"alice's delivered app link opens the reset screen and its new password signs in",
	[],
	function* ({ request, messages, openReset, enter, click, settle, screenText, signIn }) {
		yield* request("ResetPassword");
		expect(yield* messages()).toMatchObject([
			{ _tag: "ResetPassword", url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:5173\/reset-password\?token=.+/u) },
		]);
		yield* openReset();
		yield* settle();
		yield* enter('input[type="password"]', "alice-replacement-password");

		yield* click({ name: "Change password", role: "button" });
		yield* settle();

		const text = yield* screenText();
		expect(text).toContain("Password changed.");

		const signedIn = yield* signIn("alice-replacement-password");
		expect(signedIn).toMatchObject({ data: { user: { email: "alice@app.test" } }, error: null });
	},
);
