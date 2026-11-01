import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"Fleet refuses a readable identity while an unreadable child folder may hide a duplicate and diagnoses the duplicate after recovery",
	[hasBoardItems(1)],
	function* ({ edit, makeUnreadable, makeReadable, refusalOf }) {
		yield* edit("hidden/duplicate.md", "item.0", true);
		makeUnreadable("hidden");

		expect(yield* refusalOf("item.0", { fresh: true })).toContain("hidden");

		makeReadable();

		expect(yield* refusalOf("item.0", { fresh: true })).toContain("ambiguous");
	},
);

boardReadStory.it(
	"an unreadable source defers Fleet archiving until it can establish complete membership",
	[hasBoardItems(1)],
	function* ({ makeReadable, makeUnreadable, refusalOf, storedSource, writeSource }) {
		const closed = "---\nid: closed\nkind: question\nscope: task\nurgency: whenever\nstatus: done\n---\n# Closed question";
		yield* writeSource("closed.md", closed);
		expect(yield* storedSource("closed.md")).toBe(closed);

		makeUnreadable("0.md");

		yield* outcomes([
			["unavailable identity", () => refusalOf("item.0", { fresh: true }), expect.stringContaining("0.md")],
			["unarchived source", () => storedSource("closed.md"), closed],
		]);

		makeReadable();

		yield* outcomes([
			["readable identity", () => refusalOf("item.0", { fresh: true }), "accepted"],
			["archived source", () => storedSource("closed.md"), "missing"],
		]);
	},
);
