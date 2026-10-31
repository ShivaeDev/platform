import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { goalProgressFixture, largeGoalFixture, progressFleet } from "#test/goalProgressFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

const ALL_STATES = "1 of 14 done, 1 done, 2 running, 4 blocked, 2 scheduled, 5 parked";

screenStory.it(
	"a goal card on Today counts its work in all five states, including the work of its nested goals",
	[routedScreen(goalProgressFixture(), "/", { fleet: progressFleet(), home: "home.md" })],
	function* ({ goalCardProgress }) {
		expect(yield* goalCardProgress("goal.progress")).toEqual(expect.objectContaining({ shown: "1/14 done", spoken: ALL_STATES }));
	},
);

screenStory.it(
	"a goal page counts the same five states as its card, and its child lane counts the child's own work",
	[routedScreen(goalProgressFixture(), "/_board/item/goal.progress/", { fleet: progressFleet(), home: "home.md" })],
	function* ({ childLaneProgress, goalPageProgress }) {
		yield* outcomes({
			"child lane": [
				childLaneProgress("goal.child"),
				expect.objectContaining({ shown: "0/3 done", spoken: "0 of 3 done, 0 done, 1 running, 2 blocked, 0 scheduled, 0 parked" }),
			],
			goal: [goalPageProgress(), expect.objectContaining({ spoken: ALL_STATES })],
		});
	},
);

screenStory.it(
	"a standing home with all its work done stays among the active goals",
	[routedScreen(goalProgressFixture(), "/_board/goals", { fleet: progressFleet(), home: "home.md" })],
	function* ({ goalCardProgress, goalList }) {
		yield* outcomes({
			"active goals": [goalList(), expect.objectContaining({ active: expect.arrayContaining(["goal.standing"]) })],
			"standing home": [goalCardProgress("goal.standing"), expect.objectContaining({ shown: "1/1 done" })],
		});
	},
);

screenStory.it(
	"a standing home's page calls it a standing home for new work, not done",
	[routedScreen(goalProgressFixture(), "/_board/item/goal.standing/", { fleet: progressFleet(), home: "home.md" })],
	function* ({ goalPageProgress, goalPageTags, goalProgressNotice }) {
		yield* outcomes({
			"not done": [goalPageTags(), expect.not.arrayContaining(["Done"])],
			notice: [goalProgressNotice(), "This goal is a standing home for new work."],
			progress: [goalPageProgress(), expect.objectContaining({ shown: "1/1 done" })],
			tags: [goalPageTags(), expect.arrayContaining(["Standing home"])],
		});
	},
);

screenStory.it(
	"a goal with 485 done, 18 parked and 54 dropped tasks leaves the dropped ones out of its progress",
	[routedScreen(largeGoalFixture(), "/_board/goals")],
	function* ({ goalCardProgress }) {
		expect(yield* goalCardProgress("goal.large")).toEqual(
			expect.objectContaining({ shown: "485/503 done", spoken: "485 of 503 done, 485 done, 0 running, 0 blocked, 0 scheduled, 18 parked" }),
		);
	},
);
