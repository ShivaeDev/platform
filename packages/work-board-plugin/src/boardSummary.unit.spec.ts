import { describe, expect, it } from "vitest";
import { bandLine, flightGroups, goalOrder, goalShare, stageCounts, startedShare } from "#summary.ts";
import type { WorkboardFlight, WorkboardGoal } from "#types/index.d.ts";

function goal(id: string, done: number, ready: number, total: number): WorkboardGoal {
	return { done, id, ready, title: id.replace("goal.", ""), total };
}

function flight(workId: string, stage: string, goalId: string | null): WorkboardFlight {
	return {
		goal: goalId === null ? null : { id: goalId, title: goalId.replace("goal.", "") },
		inStageMs: 0,
		prUrl: null,
		stage,
		title: workId,
		workId,
	};
}

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

	it("shares a goal's done and started work, capped at the whole", () => {
		expect([goalShare(goal("goal.a", 1, 2, 4)), startedShare(goal("goal.a", 1, 2, 4))]).toEqual([0.25, 0.75]);
		expect([goalShare(goal("goal.over", 5, 1, 4)), startedShare(goal("goal.over", 5, 1, 4))]).toEqual([1, 1]);
		expect([goalShare(goal("goal.empty", 0, 0, 0)), startedShare(goal("goal.empty", 0, 0, 0))]).toEqual([0, 0]);
	});

	it("orders open goals by progress, then empty goals, then finished ones", () => {
		const goals = [goal("goal.done", 2, 0, 2), goal("goal.empty", 0, 0, 0), goal("goal.half", 1, 0, 2), goal("goal.start", 0, 1, 2)];
		expect(goalOrder(goals).map((entry) => entry.id)).toEqual(["goal.start", "goal.half", "goal.empty", "goal.done"]);
	});

	it("counts working stages in their fixed order and groups flights by goal, largest first and Other last", () => {
		const flights = [
			flight("one", "reviewing", "goal.small"),
			flight("two", "working", null),
			flight("three", "working", "goal.big"),
			flight("four", "waiting", "goal.big"),
		];
		expect(stageCounts(flights)).toEqual([
			{ count: 2, stage: "working" },
			{ count: 1, stage: "reviewing" },
			{ count: 1, stage: "waiting" },
		]);
		expect(flightGroups(flights).map((group) => [group.goal?.id ?? "Other", group.items.map((item) => item.workId)])).toEqual([
			["goal.big", ["three", "four"]],
			["goal.small", ["one"]],
			["Other", ["two"]],
		]);
	});
});
