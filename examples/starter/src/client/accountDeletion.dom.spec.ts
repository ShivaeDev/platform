import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ALICE_PASSWORD, accountDeletion } from "#test-support/accountDeletion.ts";

accountDeletion.it(
	"alice deletes her account with her password from her account screen and lands on sign-in",
	[],
	function* ({ clickControl, enterControl, heading, href, settle }) {
		yield* settle();
		yield* clickControl({ name: "Delete account", role: "button" });
		yield* enterControl("input[type=password]", ALICE_PASSWORD);

		yield* clickControl({ name: "Delete my account", role: "button" });
		yield* settle();

		yield* outcomes([
			["location", href, "/sign-in"],
			["page", heading, "Sign in"],
		]);
	},
);

accountDeletion.it(
	"a wrong password keeps alice on her account screen with the dialog saying so",
	[],
	function* ({ clickControl, dialogAlert, enterControl, heading, href, settle }) {
		yield* settle();
		yield* clickControl({ name: "Delete account", role: "button" });
		yield* enterControl("input[type=password]", "not-alice-password");

		yield* clickControl({ name: "Delete my account", role: "button" });
		yield* settle();

		yield* outcomes([
			["dialog", dialogAlert, "The password is incorrect."],
			["location", href, "/account"],
			["page", heading, "Your account"],
		]);
	},
);
