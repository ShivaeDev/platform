import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSetup } from "#test-support/admin/setup.ts";

adminSetup.it(
	"a configured GitHub account receives owner permissions when the app boots",
	[],
	function* ({ prepareAuth, mintOwnerCandidate, startApp, session }) {
		yield* prepareAuth();
		yield* mintOwnerCandidate();

		yield* startApp("github:1001");

		expect(yield* session()).toMatchObject({
			user: { email: "alice@github.test", permissions: expect.arrayContaining([{ name: "roles.assign", strength: "own" }]), role: "owner" },
		});
	},
);

adminSetup.it(
	"a new app can bootstrap its first admin with the command and sign in",
	[],
	function* ({ prepareAuth, createAdmin, startApp, signIn, session }) {
		yield* prepareAuth();
		const bootstrap = yield* createAdmin("first-admin@app.test", "first-admin-password-123");
		expect(bootstrap.code, bootstrap.output + bootstrap.errors).toBe(0);
		yield* startApp();
		yield* outcomes([
			[
				"sign-in response",
				() =>
					Effect.gen(function* () {
						return (yield* signIn("first-admin@app.test", "first-admin-password-123")).status;
					}),
				HttpStatus.fromLiteral("OK"),
			],
			[
				"signed-in session",
				() => session(),
				expect.objectContaining({
					user: expect.objectContaining({
						email: "first-admin@app.test",
						name: "Administrator",
						permissions: expect.arrayContaining([
							{ name: "users.read", strength: "own" },
							{ name: "roles.assign", strength: "own" },
							{ name: "jobs.read", strength: "own" },
						]),
						role: "owner",
					}),
				}),
			],
		]);
		const duplicate = yield* createAdmin("first-admin@app.test", "another-admin-password-123");
		expect(duplicate.code).not.toBe(0);
	},
);
