import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, readerAt } from "#test/boardStory.ts";

const SOURCE = "# Page-free reading\n\nThe server still reads project documents.";

boardStory.it(
	"serves the project without a bundle page and names the missing reader trait on page access",
	[projectFiles({ "note.md": SOURCE })],
	function* (told) {
		const document = yield* told.readDocument("note.md");
		expect(document.source).toBe(SOURCE);
		expect(told.story.engine.live).toBeUndefined();
		expect(() => told.page).toThrow("readerAt(path)");
		const opened = yield* Effect.exit(told.reader.open("/note.md"));
		expect(Exit.isFailure(opened)).toBe(true);
		if (Exit.isFailure(opened)) {
			expect(Cause.pretty(opened.cause)).toContain("readerAt(path)");
		}
		expect(told.story.engine.live).toBeUndefined();
	},
);

boardStory.it(
	"opens the built reader after project traits even when the reader trait is listed first",
	[readerAt("/note.md"), projectFiles({ "note.md": SOURCE })],
	({ page }) => {
		expect(page.document.getElementById("doc")?.textContent).toContain("The server still reads project documents.");
		expect(page.window.location.pathname).toBe("/note.md");
	},
);
