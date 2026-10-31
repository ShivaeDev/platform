import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const note = projectFiles({ "note.md": "# Reading context" });

for (const how of ["query", "run"] as const) {
	boardStory.it(
		`a ${how === "query" ? "document query" : "direct document call"} canceled by the reader rejects as canceled`,
		[note],
		function* ({ canceledDocumentRead }) {
			expect(yield* canceledDocumentRead(how)).toBe("canceled: Reading canceled");
		},
	);
}

boardStory.it(
	"a document query for a file that has become unreadable answers internal server error",
	[note],
	function* ({ documentQueryAnswer, permissions, sourceOf }) {
		expect(yield* sourceOf("note.md")).toBe("# Reading context");

		permissions("note.md", 0o000);

		expect(yield* documentQueryAnswer("note.md")).toBe("internal server error");
	},
);
