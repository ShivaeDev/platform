import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { goalProgressFixture, largeGoalFixture, progressFleet } from "#test/goalProgressFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

screenStory.it(
	"shows five progress states on the home list and rolls nested goals into their parent",
	[routedScreen(goalProgressFixture(), "/", { fleet: progressFleet(), home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(findElement('[data-goal-id="goal.progress"] [data-goal-progress]')).not.toBeNull());
		const card = findElement('[data-goal-id="goal.progress"]');
		expect(findElements("[data-goal-state]", card).map((segment) => [segment.dataset.goalState, segment.dataset.count, segment.title])).toEqual([
			["done", "1", "Done: 1"],
			["running", "2", "Running: 2"],
			["blocked", "4", "Blocked: 4"],
			["scheduled", "2", "Scheduled: 2"],
			["parked", "5", "Parked: 5"],
		]);
		expect(readText('[data-slot="progress-value"]', card)).toBe("1/14 done");
		const standing = findElement('[data-goal-id="goal.standing"]');
		expect(standing).not.toBeNull();
		expect(readText('[data-slot="progress-value"]', standing)).toBe("1/1 done");
	},
);

screenStory.it(
	"shows the same progress states on a goal page and its child lane",
	[routedScreen(goalProgressFixture(), "/_board/item/goal.progress/", { fleet: progressFleet(), home: "home.md" })],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(readText('[data-goal-section="progress"] [data-slot="progress-value"]')).toBe("1/14 done"));
		const progress = findElement('[data-goal-section="progress"]');
		expect(
			findElements("[data-goal-counts] > li", progress)
				.slice(0, 5)
				.map((segment) => [segment.dataset.status, segment.dataset.count]),
		).toEqual([
			["done", "1"],
			["running", "2"],
			["blocked", "4"],
			["scheduled", "2"],
			["parked", "5"],
		]);
		const child = findElement('section[aria-label="goal.child"]', progress);
		expect(findElements("[data-goal-state]", child).map((segment) => segment.dataset.count)).toEqual(["0", "1", "2", "0", "0"]);
		expect(readText('[data-slot="progress-value"]', child)).toBe("0/3 done");
	},
);

screenStory.it(
	"keeps a fully completed standing home active and describes it on its page",
	[routedScreen(goalProgressFixture(), "/_board/goals", { fleet: progressFleet(), home: "home.md" })],
	function* ({ findElement, findElements, readText, navigate }) {
		yield* eventually(() => expect(findElement('[data-goal-id="goal.standing"]')).not.toBeNull());
		const standing = findElement('[data-goal-id="goal.standing"]');
		expect(standing?.closest("details")).toBeNull();
		expect(readText('[data-slot="progress-value"]', standing)).toBe("1/1 done");
		yield* Effect.promise(() => navigate("/_board/item/goal.standing/"));
		yield* eventually(() => expect(readText('[data-goal-section="progress"]')).toContain("This goal is a standing home for new work."));
		expect(readText(".item-summary")).toContain("Standing home");
		expect(findElements(".item-summary [data-status-token]").map((token) => token.textContent)).not.toContain("Done");
		expect(readText('[data-goal-section="progress"] [data-slot="progress-value"]')).toBe("1/1 done");
	},
);

screenStory.it(
	"leaves 54 dropped tasks out of a goal with 485 done and 18 parked",
	[routedScreen(largeGoalFixture(), "/_board/goals")],
	function* ({ findElement, findElements, readText }) {
		yield* eventually(() => expect(readText('[data-goal-id="goal.large"] [data-slot="progress-value"]')).toBe("485/503 done"));
		expect(findElements("[data-goal-state]", findElement('[data-goal-id="goal.large"]')).map((segment) => segment.dataset.count)).toEqual([
			"485",
			"0",
			"0",
			"0",
			"18",
		]);
	},
);
