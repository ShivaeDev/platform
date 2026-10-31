import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { silentWatch } from "#test/faults.ts";

const unheard = boardFilesystem(silentWatch);
const CHANGE = "Changed before watcher notification.";

for (const [kind, source] of [
	["plain Markdown", "# Plain note\n"],
	["front matter", "---\nid: note\n---\n# Note\n"],
	["a byte order mark and CRLF line endings", "﻿---\r\nid: note\r\n---\r\n# Note\r\n"],
	["broken front matter", "---\nid: [broken\n---\n# Note\n"],
	["unterminated front matter", "---\nid: note\n# Unterminated\n"],
] as const) {
	boardStory.it(
		`an edit to a note with ${kind} is read fresh before the watcher reports it`,
		[projectFiles({ "note.md": source }), unheard],
		function* ({ editFile, sourceOf }) {
			expect(yield* sourceOf("note.md")).not.toContain(CHANGE);

			editFile("note.md", `${source}\n${CHANGE}`);

			expect(yield* sourceOf("note.md")).toContain(CHANGE);
		},
	);
}

boardStory.it(
	"a note edited to take another file's identity loses its own on the next read, shows the duplicate and frees its old item route, before the watcher reports it",
	[
		projectFiles({
			"note.md": "---\nid: original\nrelationships:\n - kind: informs\n   target: original\n---\n# Note",
			"other.md": "---\nid: other\nrelationships:\n - kind: informs\n   target: original\n---\n# Other",
		}),
		unheard,
	],
	function* ({ documentFacts, editFile, httpAnswer }) {
		expect(yield* documentFacts("note.md")).toEqual({ identity: "original", problems: [] });

		editFile("note.md", "---\nid: other\n---\n# Changed");

		yield* outcomes([
			["its old item route", () => httpAnswer("/_board/item/original/"), "404 Not Found"],
			["the note", () => documentFacts("note.md"), { identity: "none", problems: [expect.stringContaining("Duplicate ID other")] }],
		]);
	},
);
