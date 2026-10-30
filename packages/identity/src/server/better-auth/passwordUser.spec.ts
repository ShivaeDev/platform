import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { adaPassword, passwordAuth } from "#test/better-auth/password.ts";

passwordAuth.it(
	"ada's password user signs in through the email route and holds an authenticated session",
	[adaPassword],
	function* ({ signIn, session }) {
		expect(yield* session()).toBe("signed out");

		const status = yield* signIn();

		expect(status).toBe(HttpStatus.fromLiteral("OK"));

		expect(yield* session()).toEqual({ email: "ada@password.test", name: "ada" });
	},
);
