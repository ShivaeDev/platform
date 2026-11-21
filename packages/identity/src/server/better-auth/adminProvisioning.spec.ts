import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { demoSeedStory } from "#test/demo-seed/story.ts";

demoSeedStory.it(
	"the admin step creates alice as an owner named Administrator who signs in with the configured password",
	[],
	function* ({ provisionAdmin, signIn, storedUsers }) {
		yield* provisionAdmin("alice@admin.test", "alice-admin-password");

		yield* outcomes([
			["stored users", () => storedUsers(), [{ email: "alice@admin.test", name: "Administrator", role: "owner" }]],
			["alice signs in", () => signIn("alice@admin.test", "alice-admin-password"), { email: "alice@admin.test", name: "Administrator" }],
		]);
	},
);

demoSeedStory.it(
	"running the admin step again for alice's address keeps her one owner account and her first password",
	[],
	function* ({ provisionAdmin, signIn, storedUsers }) {
		yield* provisionAdmin("alice@admin.test", "alice-admin-password");
		const first = yield* storedUsers();

		yield* provisionAdmin("alice@admin.test", "another-admin-password");

		yield* outcomes([
			["stored users", () => storedUsers(), first],
			[
				"alice signs in with her first password",
				() => signIn("alice@admin.test", "alice-admin-password"),
				{ email: "alice@admin.test", name: "Administrator" },
			],
		]);
	},
);

for (const [kind, password] of [
	["an empty", ""],
	["a seven-character", "seven77"],
	["a 129-character", "p".repeat(129)],
] as const) {
	demoSeedStory.it(
		`the admin step refuses ${kind} password by naming the limits and creates no account`,
		[],
		function* ({ provisionAdmin, storedUsers }) {
			const answer = yield* provisionAdmin("alice@admin.test", password);

			yield* outcomes([
				["admin step", () => Effect.succeed(answer), "ADMIN_PASSWORD must be 8 to 128 characters long"],
				["stored users", () => storedUsers(), []],
			]);
		},
	);
}

demoSeedStory.it(
	"the admin step refuses an address whose account signed up without verifying it and leaves that account a reader",
	[],
	function* ({ provisionAdmin, signsUp, storedUsers }) {
		yield* signsUp("alice@admin.test");

		const answer = yield* provisionAdmin("alice@admin.test", "alice-admin-password");

		yield* outcomes([
			[
				"admin step",
				() => Effect.succeed(answer),
				"ADMIN_EMAIL alice@admin.test belongs to an account whose address is not verified; verify it or choose another address",
			],
			["stored users", () => storedUsers(), [{ email: "alice@admin.test", role: "reader" }]],
		]);
	},
);
