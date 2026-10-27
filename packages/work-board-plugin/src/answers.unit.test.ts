import { describe, expect, it } from "vitest";
import { flightsOf, goalsOf, goalTitlesOf } from "#answers.ts";

const NOW = 1_800_000_000_000;

describe("Fleet items and goals", () => {
	it("keeps started unfinished work, links each item to the goal it implements and times each agent turn", () => {
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
						agents: [{ finishedAt: NOW - 60_000, id: "worker", role: "worker", startedAt: NOW - 120_000, state: "done" }],
						document: { metadata: { relationships: [{ kind: "implements", target: "goal.closed#part" }] }, title: "Linked" },
						inFlight: true,
						prUrl: "https://github.com/example/repo/pull/7",
						stage: "reviewing",
						stageEnteredAt: NOW - 60_000,
						workId: "task.linked",
					},
					{
						document: { metadata: { relationships: [{ kind: "implements", target: "project.x" }] } },
						inFlight: true,
						stage: "working",
						workId: "task.loose",
					},
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
					agents: [{ id: "worker", role: "worker", state: "done", turnMs: 60_000 }],
					goal: { id: "goal.closed", title: "Closed goal" },
					prUrl: "https://github.com/example/repo/pull/7",
					stage: "reviewing",
					title: "Linked",
					workId: "task.linked",
				},
				{ agents: [], goal: null, prUrl: null, stage: "working", title: "task.loose", workId: "task.loose" },
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
			goalsOf({ goals: [{ counts: { achieved: false, blocked: 4, done: 2, parked: 5, running: 3, scheduled: 1 }, id: "goal.a", standing: true }] })
				.items,
		).toEqual([
			{ achieved: false, blocked: 4, done: 2, id: "goal.a", parked: 5, running: 3, scheduled: 1, standing: true, title: "goal.a", total: 15 },
		]);
	});
});
