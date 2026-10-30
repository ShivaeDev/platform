import { expect } from "vitest";
import { existingNotes, migration } from "#modules/notes/test-support/migration.ts";

migration.it("creates the final notes columns on the foundation schema", [], function* ({ addNotes }) {
	expect(yield* addNotes()).toEqual([
		{ name: "id", type: "integer" },
		{ name: "title", type: "text" },
		{ name: "user_id", type: "text" },
		{ name: "version", type: "integer" },
		{ name: "word_count", type: "integer" },
	]);
});

migration.it(
	"existing notes gain user referential integrity when the app upgrades",
	[existingNotes],
	function* ({ addUserReference, deleteUser, storedNoteTitles }) {
		yield* addUserReference();
		expect(yield* storedNoteTitles).toEqual([{ title: "Alice note" }, { title: "Legacy note" }]);
		yield* deleteUser();
		expect(yield* storedNoteTitles).toEqual([{ title: "Legacy note" }]);
	},
);
