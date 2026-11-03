import { expect } from "vitest";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"Fleet refuses a readable identity while an unreadable child folder may hide a duplicate and diagnoses the duplicate after recovery",
	[hasBoardItems(1)],
	function* ({ edit, makeUnreadable, makeReadable, refusalOf }) {
		yield* edit("hidden/duplicate.md", "item.0", true);
		yield* makeUnreadable("hidden");

		expect(yield* refusalOf("item.0", { fresh: true })).toContain("hidden");

		yield* makeReadable();

		expect(yield* refusalOf("item.0", { fresh: true })).toContain("ambiguous");
	},
);
