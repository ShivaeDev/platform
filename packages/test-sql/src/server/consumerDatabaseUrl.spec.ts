import { expect } from "vitest";
import { emptyPostgresStory } from "#test/emptyPostgresStory.ts";

emptyPostgresStory.it("a consumer-selected empty template persists the story's notes", [], function* ({ notes, recordNote }) {
	expect(yield* notes()).toEqual([]);

	yield* recordNote("Call Alice");

	expect(yield* notes()).toEqual([{ body: "Call Alice" }]);
});
