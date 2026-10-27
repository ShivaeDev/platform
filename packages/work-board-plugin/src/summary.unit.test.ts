import { describe, expect, it } from "vitest";
import { bandLine, flightGroups, goalOrder, goalShare } from "#summary.ts";
import { flight, goal } from "#test/summaryFixtures.ts";

describe("the board summary", () => {
	it("sums Needs you, In flight and goal progress, with ? for a query the Board could not answer", () => {
		const ready = {
			asks: { items: [{ key: "open:a", title: "A", url: null }], problem: null },
			flights: { items: [flight("one", "working", null)], problem: null },
			goals: { items: [goal("goal.a", 3, 1, 5), goal("goal.b", 2, 0, 2)], problem: null },
			kind: "ready" as const,
		};
		expect(bandLine(ready)).toBe("Needs you 1 · In flight 1 · Goals 5/7");
		expect(bandLine({ ...ready, asks: { items: [], problem: "down" }, goals: { items: [], problem: "down" } })).toBe(
			"Needs you ? · In flight 1 · Goals ?",
		);
	});

	it("shares a goal's done work, capped at the whole", () => {
		expect(goalShare(goal("goal.a", 1, 2, 4))).toBe(0.25);
		expect(goalShare(goal("goal.over", 5, 0, 4))).toBe(1);
		expect(goalShare(goal("goal.empty", 0, 0, 0))).toBe(0);
	});

	it("orders open goals by progress, then empty goals, then finished ones", () => {
		const goals = [
			{ ...goal("goal.standing", 1, 0, 1), standing: true },
			goal("goal.done", 2, 0, 2),
			goal("goal.empty", 0, 0, 0),
			goal("goal.half", 1, 0, 2),
			goal("goal.start", 0, 1, 2),
		];
		expect(goalOrder(goals).map((entry) => entry.id)).toEqual(["goal.start", "goal.half", "goal.standing", "goal.empty", "goal.done"]);
	});

	it("counts working stages in their fixed order and groups flights by goal, largest first and Other last", () => {
		const flights = [
			flight("one", "reviewing", "goal.small"),
			flight("two", "working", null),
			flight("three", "working", "goal.big"),
			flight("four", "waiting", "goal.big"),
		];

		expect(flightGroups(flights).map((group) => [group.goal?.id ?? "Other", group.items.map((item) => item.workId)])).toEqual([
			["goal.big", ["three", "four"]],
			["goal.small", ["one"]],
			["Other", ["two"]],
		]);
	});
});
