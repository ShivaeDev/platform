import { describe, expect, it } from "vitest";
import { flightsOf, goalsOf, goalTitlesOf } from "#answers.ts";

const NOW = 1_800_000_000_000;

describe("Fleet items and goals", () => {
	it("keeps unfinished stages, links each item to the goal it implements and times its stage", () => {
		const titles = goalTitlesOf({
			closedGoals: [{ id: "goal.closed", title: "Closed goal" }],
			deferredGoals: [{ id: "goal.parked", title: "Parked goal" }],
			goals: [{ id: "project.open" }],
		});
		expect(titles.get("goal.parked")).toBe("Parked goal");
		const flights = flightsOf(
			{
				items: [
					{
						document: { metadata: { relationships: [{ kind: "implements", target: "goal.closed#part" }] }, title: "Linked" },
						prUrl: "https://github.com/example/repo/pull/7",
						stage: "reviewing",
						stageEnteredAt: NOW - 60_000,
						workId: "task.linked",
					},
					{ document: { metadata: { relationships: [{ kind: "implements", target: "project.x" }] } }, stage: "working", workId: "task.loose" },
					{ stage: "queued", workId: "task.waiting" },
				],
				state: "ready",
			},
			NOW,
			titles,
		);
		expect(flights).toEqual({
			items: [
				{
					goal: { id: "goal.closed", title: "Closed goal" },
					inStageMs: 60_000,
					prUrl: "https://github.com/example/repo/pull/7",
					stage: "reviewing",
					title: "Linked",
					workId: "task.linked",
				},
				{ goal: null, inStageMs: null, prUrl: null, stage: "working", title: "task.loose", workId: "task.loose" },
				{ goal: null, inStageMs: null, prUrl: null, stage: "queued", title: "task.waiting", workId: "task.waiting" },
			],
			problem: null,
		});
	});

	it("says why Fleet has no items", () => {
		expect(flightsOf({ reason: "Fleet is not configured", state: "unavailable" }, NOW).problem).toBe("Fleet is unavailable: Fleet is not configured");
		expect(flightsOf(null, NOW).problem).toBe("Fleet sent no items.");
	});

	it("keeps the five progress states and standing-home flag from the Board", () => {
		expect(
			goalsOf({ goals: [{ counts: { blocked: 4, done: 2, parked: 5, running: 3, scheduled: 1 }, id: "goal.a", standing: true }] }).items,
		).toEqual([{ blocked: 4, done: 2, id: "goal.a", parked: 5, running: 3, scheduled: 1, standing: true, title: "goal.a", total: 15 }]);
	});
});
