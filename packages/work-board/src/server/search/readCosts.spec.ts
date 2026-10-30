import { Order } from "effect";
import { expect } from "vitest";
import { indexedAliases } from "#test/indexedAliases.ts";
import { indexedFiles, indexStory } from "#test/indexStory.ts";

const files = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`notes/deep/item-${index}.md`, `# Item ${index}`]));

indexStory.it("shares path and directory checks across a full nested-folder read", [indexedFiles(files)], function* ({ readIndex, pathChecks }) {
	const snapshot = yield* readIndex();

	expect(snapshot.documents.map((document) => document.file).sort(Order.String)).toEqual(Object.keys(files).sort(Order.String));
	expect(snapshot.unavailable).toEqual([]);
	expect(pathChecks()).toBeLessThan(4 * Object.keys(files).length);
});

indexStory.it(
	"resolves retargeted aliases afresh during the next full read",
	[indexedFiles({ "first/note.md": "# First", "second/note.md": "# Second" }), indexedAliases],
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
