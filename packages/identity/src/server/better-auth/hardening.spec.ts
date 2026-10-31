import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hardening, passwordCheckDisabled, resetRevocationDisabled, signedInAlice } from "#test/better-auth/hardening.ts";

for (const [description, password] of Object.entries({
	empty: "",
	missing: undefined,
	"non-string": 123,
	overlong: "a".repeat(129),
	wrong: "wrong-password",
})) {
	hardening.it(
		`alice's email change is refused with a ${description} password and leaves her email unchanged`,
		[signedInAlice()],
		function* ({ changeEmail, response, sessionEmail }) {
			expect(yield* sessionEmail()).toBe("alice@example.test");

			yield* changeEmail(password);

			yield* outcomes({
				"alice's email": [sessionEmail(), "alice@example.test"],
				"email change response": [
					response(),
					{ body: expect.objectContaining({ code: "INVALID_PASSWORD" }), status: HttpStatus.fromLiteral("BadRequest") },
				],
			});
		},
	);
}

hardening.it(
	"alice's current password lets her change her unverified email",
	[signedInAlice()],
	function* ({ changeEmail, currentPassword, response, sessionEmail }) {
		expect(yield* sessionEmail()).toBe("alice@example.test");

		yield* changeEmail(yield* currentPassword());

		yield* outcomes({
			"alice's email": [sessionEmail(), "alice-new@example.test"],
			"email change response": [response(), { body: { status: true }, status: HttpStatus.fromLiteral("OK") }],
		});
	},
);

hardening.it(
	"alice cannot change her email when her account has no password",
	[signedInAlice({ password: false })],
	function* ({ changeEmail, response, sessionEmail }) {
		yield* changeEmail("any-password");

		yield* outcomes({
			"alice's email": [sessionEmail(), "alice@example.test"],
			"email change response": [
				response(),
				{ body: expect.objectContaining({ code: "INVALID_PASSWORD" }), status: HttpStatus.fromLiteral("BadRequest") },
			],
		});
	},
);

hardening.it(
	"the app's named opt-out lets alice change her email without a password",
	[passwordCheckDisabled, signedInAlice()],
	function* ({ changeEmail, response, sessionEmail }) {
		yield* changeEmail();

		yield* outcomes({
			"alice's email": [sessionEmail(), "alice-new@example.test"],
			"email change response": [response(), { body: { status: true }, status: HttpStatus.fromLiteral("OK") }],
		});
	},
);

for (const correct of [false, true]) {
	hardening.it(
		`alice's verified email change ${correct ? "sends verification with" : "sends no verification without"} her current password`,
		[signedInAlice({ verified: true })],
		function* ({ changeEmail, currentPassword, response, verificationSent }) {
			yield* changeEmail(correct ? yield* currentPassword() : undefined);

			yield* outcomes({
				"email change response": [response(), expect.objectContaining({ status: HttpStatus.fromLiteral(correct ? "OK" : "BadRequest") })],
				"verification email sent": [verificationSent(), correct],
			});
		},
	);
}

for (const correct of [false, true]) {
	hardening.it(
		`alice's signed bearer session ${correct ? "allows" : "refuses"} an email change ${correct ? "with" : "without"} her current password`,
		[signedInAlice()],
		function* ({ changeEmail, currentPassword, response, sessionEmail }) {
			yield* changeEmail(correct ? yield* currentPassword() : undefined, true);

			yield* outcomes({
				"alice's email": [sessionEmail(), correct ? "alice-new@example.test" : "alice@example.test"],
				"email change response": [response(), expect.objectContaining({ status: HttpStatus.fromLiteral(correct ? "OK" : "BadRequest") })],
			});
		},
	);
}

for (const retain of [false, true]) {
	hardening.it(
		`alice's password reset ${retain ? "retains her session with the app's named opt-out" : "revokes her session by default"}`,
		[...(retain ? [resetRevocationDisabled] : []), signedInAlice()],
		function* ({ requestPasswordReset, resetPassword, sessionEmail }) {
			expect(yield* sessionEmail()).toBe("alice@example.test");
			expect(yield* requestPasswordReset()).toBe(HttpStatus.fromLiteral("OK"));

			const status = yield* resetPassword();

			yield* outcomes({
				"alice's existing session": [sessionEmail(), retain ? "alice@example.test" : "signed out"],
				"reset response": [Effect.succeed(status), HttpStatus.fromLiteral("OK")],
			});
		},
	);
}
