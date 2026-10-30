import { expect } from "vitest";
import {
	boardTools,
	decisionWaits,
	fleetHolds,
	fleetUnavailable,
	goalsCounted,
	nextAmongOtherRequests,
	onlyAnEarlierRequest,
	taskAuthored,
} from "#test/boardTools.ts";

const goalA = { counts: { done: 1, parked: 3 }, id: "goal.a", title: "Goal A" };
const goalB = { counts: { done: 2, running: 1, scheduled: 1 }, id: "goal.b", title: "Goal B" };

boardTools.it("board_overview counts decision.a under Needs you with its title and reason", [decisionWaits], function* ({ overviewNeedsYou }) {
	expect(yield* overviewNeedsYou()).toEqual({ count: 1, you: [{ id: "decision.a", reason: "Pick one", title: "Decide" }] });
});

boardTools.it("board_overview lists goal.a and goal.b with their tasks in each state", [goalsCounted(goalA, goalB)], function* ({ overviewGoals }) {
	expect(yield* overviewGoals()).toEqual([
		{ achieved: false, blocked: 0, done: 1, id: "goal.a", parked: 3, running: 0, scheduled: 0, standing: false, title: "Goal A", total: 4 },
		{ achieved: false, blocked: 0, done: 2, id: "goal.b", parked: 0, running: 1, scheduled: 1, standing: false, title: "Goal B", total: 4 },
	]);
});

boardTools.it("board_overview sums the done and total tasks of goal.a and goal.b", [goalsCounted(goalA, goalB)], function* ({ overviewGoalTotals }) {
	expect(yield* overviewGoalTotals()).toEqual({ done: 3, total: 8 });
});

boardTools.it(
	"board_overview passes on Fleet's own reason when Fleet is unavailable",
	[fleetUnavailable("Fleet is not configured")],
	function* ({ overviewFleet }) {
		expect(yield* overviewFleet()).toEqual({ reason: "Fleet is not configured", state: "unavailable" });
	},
);

boardTools.it(
	"needs_you gives decision.a the options, prompts and recommendation of the request its link opens",
	[decisionWaits, nextAmongOtherRequests],
	function* ({ askedOf }) {
		expect(yield* askedOf("decision.a")).toEqual({ options: [{ label: "Go" }], prompts: [{ text: "Why?" }], recommended: "Go" });
	},
);

boardTools.it(
	"needs_you falls back to decision.a's own options and recommendation when no request matches its link",
	[decisionWaits, onlyAnEarlierRequest],
	function* ({ askedOf }) {
		expect(yield* askedOf("decision.a")).toEqual({ options: [{ label: "Fallback" }], prompts: [], recommended: "Fallback" });
	},
);

boardTools.it("needs_you gives decision.a an age of the 5 seconds since decide.md changed", [decisionWaits], function* ({ ageOf }) {
	expect(yield* ageOf("decision.a")).toBe("5 seconds");
});

boardTools.it(
	"while Fleet holds task.a as done, item reports task.a's authored owner, draft status, criterion and only its open decision",
	[taskAuthored, fleetHolds("done")],
	function* ({ authoredOf }) {
		expect(yield* authoredOf("task.a")).toEqual({
			criteria: [{ id: "proof" }],
			openDecisions: [{ id: "r", open: true }],
			owner: "codex",
			status: "draft",
		});
	},
);

for (const stage of ["waiting", "done"] as const) {
	boardTools.it(`item task.a shows the Fleet item holding it at the ${stage} stage`, [taskAuthored, fleetHolds(stage)], function* ({ fleetOf }) {
		expect(yield* fleetOf("task.a")).toEqual({ item: { stage, workId: "task.a" }, state: "ready" });
	});
}

boardTools.it("item task.a shows no Fleet item once Fleet released it", [taskAuthored, fleetHolds("released")], function* ({ fleetOf }) {
	expect(yield* fleetOf("task.a")).toEqual({ item: null, state: "ready" });
});
