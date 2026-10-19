import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

const SOURCE = "# Page-free reading\n\nThe server still reads project documents.";

boardStory.it(
	"serves the project without a bundle page and names the missing reader trait on page access",
	[projectFiles({ "note.md": SOURCE })],
	function* (told) {
		const document = yield* told.readDocument("note.md");
		expect(document.source).toBe(SOURCE);
		expect(told.story.engine.live).toBeUndefined();
		expect(() => told.page).toThrow("The story has no bundle page.");
		const opened = yield* Effect.exit(told.reader.open("/note.md"));
		expect(Exit.isFailure(opened)).toBe(true);
		if (Exit.isFailure(opened)) {
			expect(Cause.pretty(opened.cause)).toContain("The story has no bundle page.");
		}
		expect(told.story.engine.live).toBeUndefined();
	},
);
