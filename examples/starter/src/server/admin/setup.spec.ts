import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminSetup, aliceSignedInWithGitHub } from "#test-support/admin/setup.ts";

adminSetup.it(
	"alice's GitHub account, configured as owner, makes her an owner who may assign roles when the app boots",
	[aliceSignedInWithGitHub],
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
	[],
	function* ({ adminCommandRuns, appStarts, signedInAccount, signsIn }) {
		const bootstrap = yield* adminCommandRuns("first-admin@app.test", "first-admin-password-123");

		yield* appStarts();
		yield* outcomes([
			["bootstrap", () => Effect.succeed(bootstrap), "completed"],
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

adminSetup.it(
	"running the bootstrap command again for the same email keeps the first owner and her password",
	[],
	function* ({ adminCommandRuns, appStarts, signedInAccount, signsIn }) {
		expect(yield* adminCommandRuns("first-admin@app.test", "first-admin-password-123")).toBe("completed");

		const again = yield* adminCommandRuns("first-admin@app.test", "another-admin-password-123");

		yield* appStarts();
		yield* outcomes([
			["second run", () => Effect.succeed(again), "completed"],
			["sign-in with the first password", () => signsIn("first-admin@app.test", "first-admin-password-123"), "signed in"],
			["signed-in account", () => signedInAccount(), { email: "first-admin@app.test", role: "owner" }],
		]);
	},
);
