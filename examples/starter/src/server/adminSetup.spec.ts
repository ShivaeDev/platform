import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { adminSetup } from "#test-support/adminSetup.ts";

adminSetup.it(
	"a new app can bootstrap its first admin with the command and sign in",
	[],
	function* ({ prepareAuth, createAdmin, startApp, signIn, session }) {
		yield* prepareAuth();
		const bootstrap = yield* createAdmin("first-admin@app.test", "first-admin-password-123");
		expect(bootstrap.code, bootstrap.output + bootstrap.errors).toBe(0);
		yield* startApp();
		expect((yield* signIn("first-admin@app.test", "first-admin-password-123")).status).toBe(HttpStatus.fromLiteral("OK"));
		expect(yield* session()).toMatchObject({
			user: {
				email: "first-admin@app.test",
				name: "Administrator",
				permissions: expect.arrayContaining([
					{ name: "users.read", strength: "own" },
					{ name: "roles.assign", strength: "own" },
					{ name: "jobs.read", strength: "own" },
				]),
				role: "owner",
			},
		});
		const duplicate = yield* createAdmin("first-admin@app.test", "another-admin-password-123");
		expect(duplicate.code).not.toBe(0);
	},
);
