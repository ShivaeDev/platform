import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adaPassword, passwordAuth } from "#test/better-auth/password.ts";

passwordAuth.it(
	"ada signs in and reads her session using only the application's one PostgreSQL connection",
	[adaPassword],
	function* ({ signIn, session, databaseConnections }) {
		expect(yield* session()).toBe("signed out");

		const status = yield* signIn();

		expect(status).toBe(HttpStatus.fromLiteral("OK"));

		yield* outcomes({
			"all database connections": [databaseConnections(), [1]],
			"session": [session(), { email: "ada@password.test", name: "ada" }],
		});
	},
);
