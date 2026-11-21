import { expect } from "vitest";
import { deletedAccountNotes } from "#modules/notes/test-support/deletedAccount.ts";
import { ALICE_PASSWORD } from "#test-support/accountDeletion.ts";

deletedAccountNotes.it(
	"after alice deletes her account from her account screen, her note is gone from PostgreSQL and bob's stays",
	[],
	function* ({ clickControl, enterControl, settle, storedNoteOwners }) {
		yield* settle();
		expect(yield* storedNoteOwners()).toEqual(["Alice's note of alice", "Bob's note of bob"]);
		yield* clickControl({ name: "Delete account", role: "button" });
		yield* enterControl("input[type=password]", ALICE_PASSWORD);

		yield* clickControl({ name: "Delete my account", role: "button" });
		yield* settle();

		expect(yield* storedNoteOwners()).toEqual(["Bob's note of bob"]);
	},
);
