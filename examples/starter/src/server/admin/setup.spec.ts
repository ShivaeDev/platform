import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSetup, aliceSignedInWithGitHub, authTablesReady } from "#test-support/admin/setup.ts";

adminSetup.it(
	"alice's GitHub account, configured as owner, makes her an owner who may assign roles when the app boots",
	[authTablesReady, aliceSignedInWithGitHub],
	function* ({ appStarts, signedInAccount }) {
		yield* appStarts("github:1001");

		expect(yield* signedInAccount()).toMatchObject({
			email: "alice@github.test",
			permissions: expect.arrayContaining(["roles.assign"]),
			role: "owner",
		});
	},
);

adminSetup.it(
	"the bootstrap command creates a first owner who signs in with the users, roles and jobs permissions",
	[authTablesReady],
	function* ({ adminCommandRuns, appStarts, signedInAccount, signsIn }) {
		const created = yield* adminCommandRuns("first-admin@app.test", "first-admin-password-123");

		yield* appStarts();
		yield* outcomes([
			["bootstrap", () => Effect.succeed(created), "created"],
			["sign-in", () => signsIn("first-admin@app.test", "first-admin-password-123"), "signed in"],
			[
				"signed-in account",
				() => signedInAccount(),
				{
					email: "first-admin@app.test",
					name: "Administrator",
					permissions: expect.arrayContaining(["jobs.read", "roles.assign", "users.read"]),
					role: "owner",
				},
			],
		]);
	},
);

adminSetup.it("the bootstrap command refuses a second admin with the same email", [authTablesReady], function* ({ adminCommandRuns }) {
	expect(yield* adminCommandRuns("first-admin@app.test", "first-admin-password-123")).toBe("created");

	const again = yield* adminCommandRuns("first-admin@app.test", "another-admin-password-123");

	expect(again).toBe("refused");
});
