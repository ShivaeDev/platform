import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenFleet, todayScreen } from "#test/screenWorkspaceTraits.ts";
import { todayFleetFixture } from "#test/todayFleetFixture.ts";

expectNoReactWarnings();
const TODAY = [todayScreen(), screenFleet(todayFleetFixture()), openScreen()];

screenStory.it("Today lists the asks that need the reader under Needs you", TODAY, function* ({ needsYouItems }) {
	expect(yield* needsYouItems()).toEqual([
		"decision.reader",
		"decision.review",
		"project.closed",
		"question.storage",
		"task.draft",
		"task.fifth",
		"task.person",
	]);
});

screenStory.it("Today shows a card for each active goal and leaves deferred and closed goals out", TODAY, function* ({ todayGoalIds }) {
	expect(yield* todayGoalIds()).toEqual(["project.alpha", "project.beta", "project.example"]);
});

screenStory.it(
	"a goal card on Today shows the goal's next action, with the full text on hover, and its criteria's linked work and evidence",
	TODAY,
	function* ({ todayGoalCard }) {
		expect(yield* todayGoalCard("project.example")).toEqual({
			criteria: ["First criterion: 2 linked · 2 with evidence", "Second criterion: 51 linked · 1 with evidence"],
			criteriaOpen: false,
			nextAction: { text: "Review linked work", title: "Review linked work" },
			title: "Example goal",
		});
	},
);

screenStory.it("Today's summary counts each section and links to it", TODAY, function* ({ todaySummaryParts }) {
	expect(yield* todaySummaryParts()).toEqual([
		"7 need you → #needs-you",
		"9 in progress → #in-progress",
		"3 active goals → #today-goals",
		"2 files have problems → /_board/system#source-problems",
	]);
});

screenStory.it(
	"Today puts Needs you above In progress in its main column and Goals in a column of its own",
	TODAY,
	function* ({ currentDestination, todayColumns, todayHomeLink }) {
		yield* outcomes({
			columns: [todayColumns(), [["Needs you", "In progress"], ["Goals"]]],
			"current destination": [currentDestination(), "Today, 7 need you"],
			"home link": [todayHomeLink(), { href: "/home.md", text: "Workspace notes" }],
		});
	},
);
