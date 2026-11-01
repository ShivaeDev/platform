import { expect } from "vitest";
import { existingNotes, migration } from "#modules/notes/test-support/migration.ts";

migration.it("the notes migration adds the final notes columns to the foundation schema", [], function* ({ addNotes }) {
	const columns = yield* addNotes();

	expect(columns).toEqual([
		{ name: "id", type: "integer" },
		{ name: "title", type: "text" },
		{ name: "user_id", type: "text" },
		{ name: "version", type: "integer" },
		{ name: "word_count", type: "integer" },
	]);
});

migration.it(
	"after the user foreign-key migration, deleting alice deletes her note and keeps the legacy note",
	[existingNotes],
	function* ({ addUserReference, aliceIsDeleted, storedNoteTitles }) {
		yield* addUserReference();
		expect(yield* storedNoteTitles()).toEqual(["Alice note", "Legacy note"]);

		yield* aliceIsDeleted();

		expect(yield* storedNoteTitles()).toEqual(["Legacy note"]);
	},
);
