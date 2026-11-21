import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ALICE_PASSWORD, accountDeletion } from "#test-support/accountDeletion.ts";

accountDeletion.it(
	"alice deletes her account with her password from her account screen, lands on sign-in, and her note is gone while bob's stays",
	[],
	function* ({ clickControl, enterControl, heading, href, settle, storedNoteOwners }) {
		yield* settle();
		expect(yield* storedNoteOwners()).toEqual(["Alice's note of alice", "Bob's note of bob"]);
		yield* clickControl({ name: "Delete account", role: "button" });
		yield* enterControl("input[type=password]", ALICE_PASSWORD);

		yield* clickControl({ name: "Delete my account", role: "button" });
		yield* settle();

		yield* outcomes([
			["location", href, "/sign-in"],
			["page", heading, "Sign in"],
			["stored notes", storedNoteOwners, ["Bob's note of bob"]],
		]);
	},
);

accountDeletion.it(
	"a wrong password keeps alice on her account screen with the dialog saying so, and her note stays",
	[],
	function* ({ clickControl, dialogAlert, enterControl, href, settle, storedNoteOwners }) {
		yield* settle();
		yield* clickControl({ name: "Delete account", role: "button" });
		yield* enterControl("input[type=password]", "not-alice-password");

		yield* clickControl({ name: "Delete my account", role: "button" });
		yield* settle();

		yield* outcomes([
			["dialog", dialogAlert, "The password is incorrect."],
			["location", href, "/account"],
			["stored notes", storedNoteOwners, ["Alice's note of alice", "Bob's note of bob"]],
		]);
	},
);
