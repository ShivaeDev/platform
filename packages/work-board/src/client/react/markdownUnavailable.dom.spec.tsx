import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { chunkResponse } from "#test/chunkResponse.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();

// Without Markdown the page never reports itself rendered, so these stories settle on the screen alone.
const board = [chunkResponse("markdown", "failed"), routedScreen(todayFixture(), "/home.md", { home: "home.md" })];

screenStory.it(
	"a document says Markdown could not be loaded and to reload when the renderer chunk cannot be fetched",
	[chunkResponse("markdown", "held"), routedScreen(todayFixture(), "/home.md", { home: "home.md" })],
	function* ({ chunkFails, documentBody, markdownError }) {
		expect(yield* documentBody()).toBe("");

		yield* chunkFails();

		expect(yield* markdownError()).toMatch(/^Markdown could not be loaded: .+\. Reload the page to try again\.$/u);
	},
);

screenStory.it("the Board still opens Goals after the Markdown renderer chunk could not be fetched", board, function* ({ navigateTo, shownPage }) {
	yield* navigateTo("/_board/goals");

	expect(yield* shownPage()).toBe("Goals");
});

screenStory.it(
	"another story renders a real document after a failed Markdown response",
	[readingPage({ "home.md": "# Home", "report.md": "# Report\n\nKeep the source readable." }, "/report.md")],
	function* ({ documentBody }) {
		expect(yield* documentBody()).toContain("Keep the source readable");
	},
);
