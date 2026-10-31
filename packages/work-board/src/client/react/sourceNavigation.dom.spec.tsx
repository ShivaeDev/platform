import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { attentionFixture } from "#test/attentionFixture.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

const PASSAGE = "attention-request-keyboard-review";
const SOURCE = `/attention/review.md#${PASSAGE}`;
const revealed = {
	focus: `#${PASSAGE}`,
	passage: "shown in the Source tab of the item context",
	tab: "Source",
};

screenStory.it(
	"opening a link to an attention passage reveals it in the Source tab and focuses it",
	[readingPage(attentionFixture(), SOURCE)],
	function* ({ contextTab, passageVisibility, readerFocus }) {
		yield* outcomes({
			focus: [readerFocus(), revealed.focus],
			passage: [passageVisibility(PASSAGE), revealed.passage],
			tab: [contextTab(), revealed.tab],
		});
	},
);

screenStory.it(
	"following a link to an attention passage on the same page switches from Details to the Source tab and focuses the passage",
	[readingPage(attentionFixture(), "/attention/review.md")],
	function* ({ contextTab, navigateTo, passageVisibility, readerFocus }) {
		expect(yield* contextTab()).toBe("Details");

		yield* navigateTo(SOURCE);

		yield* outcomes({
			focus: [readerFocus(), revealed.focus],
			passage: [passageVisibility(PASSAGE), revealed.passage],
			tab: [contextTab(), revealed.tab],
		});
	},
);

screenStory.it(
	"choosing an attention passage in Search reveals it in the Source tab and focuses it",
	[readingPage(attentionFixture(), "/attention/review.md")],
	function* ({ contextTab, openSearchResult, passageVisibility, readerFocus }) {
		yield* openSearchResult("keyboard-review", `/_board/item/request.search/#${PASSAGE}`);

		yield* outcomes({
			focus: [readerFocus(), revealed.focus],
			passage: [passageVisibility(PASSAGE), revealed.passage],
			tab: [contextTab(), revealed.tab],
		});
	},
);

screenStory.it(
	"coming Back to an attention passage keeps it revealed in the Source tab",
	[readingPage(attentionFixture(), SOURCE)],
	function* ({ contextTab, goBack, navigateTo, passageVisibility }) {
		yield* navigateTo("/decision.md");

		yield* goBack();

		yield* outcomes({
			passage: [passageVisibility(PASSAGE), revealed.passage],
			tab: [contextTab(), revealed.tab],
		});
	},
);
