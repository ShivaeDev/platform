import { expect } from "vitest";
import { indexedFiles, indexStory } from "#test/indexStory.ts";
import { referenceLink } from "#test/referenceLink.ts";

const files = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`notes/deep/item-${index}.md`, `# Item ${index}`]));

indexStory.it("shares path and directory checks across a full nested-folder read", [indexedFiles(files)], function* ({ readIndex, pathChecks }) {
	const snapshot = yield* readIndex();
	expect(snapshot.documents).toHaveLength(100);
	expect(snapshot.unavailable).toEqual([]);
	expect(pathChecks()).toBeLessThan(4 * snapshot.documents.length);
});

const aliases = indexStory.trait("project", "two aliases point at different folders", ({ notes }) => {
	referenceLink(notes, "alias", "first");
	referenceLink(notes, "replacement", "second");
});

indexStory.it(
	"resolves retargeted aliases afresh during the next full read",
	[indexedFiles({ "first/note.md": "# First", "second/note.md": "# Second" }), aliases],
	function* ({ readIndex, moveFile, invalidate }) {
		const before = yield* readIndex();
		expect(before.documents.find((document) => document.file === "alias/note.md")?.parsed.body).toBe("# First");
		moveFile("alias", "previous");
		moveFile("replacement", "alias");
		yield* invalidate();
		const after = yield* readIndex();
		expect(after.documents.find((document) => document.file === "alias/note.md")?.parsed.body).toBe("# Second");
		expect(after.unavailable).toEqual([]);
	},
);
