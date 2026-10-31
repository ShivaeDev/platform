import { expect } from "vitest";
import { markdownChunkFails } from "#test/markdownChunkFails.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

// Without Markdown the page never reports itself rendered, so these stories settle on the screen alone.
const board = [markdownChunkFails(), routedScreen(todayFixture(), "/home.md", { home: "home.md" })];

screenStory.it(
	"a document says Markdown could not be loaded and to reload when the renderer chunk cannot be fetched",
	board,
	function* ({ markdownError }) {
		expect(yield* markdownError()).toMatch(/^Markdown could not be loaded: .+\. Reload the page to try again\.$/u);
	},
);

screenStory.it("the Board still opens Goals after the Markdown renderer chunk could not be fetched", board, function* ({ navigateTo, shownPage }) {
	yield* navigateTo("/_board/goals");

	expect(yield* shownPage()).toBe("Goals");
});
