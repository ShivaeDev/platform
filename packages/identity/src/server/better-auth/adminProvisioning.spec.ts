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
