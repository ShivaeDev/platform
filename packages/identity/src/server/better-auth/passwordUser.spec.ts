import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adaPassword, adaPrecomputedPassword, passwordAuth } from "#test/better-auth/password.ts";
import { CURRENT_PASSWORD } from "#test/passwordCredential.ts";

passwordAuth.it(
	"ada signs in and reads her session using only the application's one PostgreSQL connection",
	[adaPassword],
	function* ({ signIn, session, databaseConnections }) {
		expect(yield* session()).toBe("signed out");

		const status = yield* signIn();

		expect(status).toBe(HttpStatus.fromLiteral("OK"));

		yield* outcomes([
			["all database connections", () => databaseConnections(), [1]],
			["session", () => session(), { email: "ada@password.test", name: "ada" }],
		]);
	},
);

passwordAuth.it("ada signs in with the password matching her precomputed credential", [adaPrecomputedPassword], function* ({ signIn, session }) {
	const status = yield* signIn(CURRENT_PASSWORD);

	yield* outcomes([
		["sign-in response", () => Effect.succeed(status), HttpStatus.fromLiteral("OK")],
		["session", () => session(), { email: "ada@password.test", name: "ada" }],
	]);
});

passwordAuth.it(
	"ada cannot sign in with a password that does not match her precomputed credential",
	[adaPrecomputedPassword],
	function* ({ signIn, session }) {
		const status = yield* signIn("incorrect-password");

		yield* outcomes([
			["sign-in response", () => Effect.succeed(status), HttpStatus.fromLiteral("Unauthorized")],
			["session", () => session(), "signed out"],
		]);
	},
);
