import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { silentWatch } from "#test/faults.ts";

for (const source of [
	"# Plain note\n",
	"---\nid: note\n---\n# Note\n",
	"\uFEFF---\r\nid: note\r\n---\r\n# Note\r\n",
	"---\nid: [broken\n---\n# Note\n",
	"---\nid: note\n# Unterminated\n",
]) {
	boardStory.it(
		`reads fresh source before watcher notification for ${JSON.stringify(source)}`,
		[projectFiles({ "note.md": source }), boardFilesystem(silentWatch)],
		function* ({ readDocument, editFile }) {
			const initial = yield* readDocument("note.md");
			editFile("note.md", `${source}\nChanged before watcher notification.`);
			const edited = yield* readDocument("note.md");
			expect(edited.source).toContain("Changed before watcher notification.");
			expect(edited.source).not.toBe(initial.source);
		},
	);
}

boardStory.it(
	"revalidates identity and dependent diagnostics before the index hears an edit",
	[
		projectFiles({
			"note.md": "---\nid: original\nrelationships:\n - kind: informs\n   target: original\n---\n# Note",
			"other.md": "---\nid: other\nrelationships:\n - kind: informs\n   target: original\n---\n# Other",
		}),
		boardFilesystem(silentWatch),
	],
	function* ({ readDocument, editFile, get }) {
		yield* readDocument("note.md");
		editFile("note.md", "---\nid: other\n---\n# Changed");
		const edited = yield* readDocument("note.md");
		expect(edited.identity).toBeUndefined();
		expect(JSON.stringify(edited.diagnostics)).toContain("Duplicate ID other");
		expect((yield* get("/_board/item/original/")).status).toBe(404);
	},
);
