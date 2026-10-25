import { expect } from "vitest";
import { migration } from "#modules/notes/test-support/migration.ts";

migration.it("creates the final notes columns on the foundation schema", [], function* ({ addNotes }) {
	expect(yield* addNotes()).toEqual([
		{ name: "id", type: "integer" },
		{ name: "owner_id", type: "text" },
		{ name: "title", type: "text" },
		{ name: "version", type: "integer" },
		{ name: "word_count", type: "integer" },
	]);
});
