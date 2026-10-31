import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { todayFixture } from "#test/todayFixture.ts";

expectNoReactWarnings();
const STORAGE = "Where should the project documents live?";

screenStory.it(
	"Answer on Today opens the question's options with the recommended option focused",
	[routedScreen(todayFixture(), "/", { home: "home.md", writable: true })],
	function* ({ answerOnToday, keyboardFocus, todayAnswer }) {
		expect(yield* todayAnswer()).toBe("closed");

		yield* answerOnToday(STORAGE);

		yield* outcomes({
			answer: [todayAnswer(), expect.objectContaining({ name: `Answer ${STORAGE}` })],
			focus: [keyboardFocus(), expect.objectContaining({ name: expect.stringContaining("Keep local files · Recommended") })],
		});
	},
);

screenStory.it(
	"Today without a configured home offers Getting started and no home link",
	[routedScreen({}, "/", { home: undefined })],
	function* ({ emptyState, todayHomeLink, todaySummary }) {
		yield* outcomes({
			"home link": [todayHomeLink(), "none"],
			"Needs you": [emptyState("Needs you"), expect.objectContaining({ action: { href: "/_board/start", label: "Getting started" } })],
			summary: [todaySummary(), "0 need you·0 ready tasks·0 active goals"],
		});
	},
);
