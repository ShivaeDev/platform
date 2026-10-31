import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { sharedVocabularyFixture } from "#test/sharedVocabularyFixture.ts";

expectNoReactWarnings();

screenStory.it(
	"Needs you names each question's scope and urgency and lists blocking questions before whenever ones",
	[routedScreen(sharedVocabularyFixture, "/")],
	function* ({ needsYouRows }) {
		expect(yield* needsYouRows()).toEqual([
			expect.objectContaining({ detail: expect.stringContaining("task · blocking"), title: "A blocking question" }),
			expect.objectContaining({ detail: expect.stringContaining("area · whenever"), title: "A later question" }),
		]);
	},
);

screenStory.it("Related work shows a standing answer as a ruling", [routedScreen(sharedVocabularyFixture, "/ready.md")], function* ({ pageRulings }) {
	expect(yield* pageRulings()).toEqual([expect.stringContaining("Use the existing engine.")]);
});

screenStory.it(
	"A standing ruling reads its answer from its body instead of reporting a missing Outcome",
	[routedScreen(sharedVocabularyFixture, "/ruling.md")],
	function* ({ decisionOutcome, pageText }) {
		yield* outcomes({
			outcome: [decisionOutcome(), "none"],
			page: [pageText(), expect.stringContaining("Use the existing engine.")],
		});
	},
);
