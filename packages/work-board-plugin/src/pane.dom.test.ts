import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { buildThePane, finishedTurnDaysAgo, queuedForSlot, waitingOnArea, waitingOnDependency } from "#test/admissionItems.ts";
import { achievedOpen, goalAnswer, goalsAnswered, onTerminal, pluginPane, workAnswered } from "#test/pluginPane.ts";

const shipTheBoard = goalAnswer("Ship the Board", { blocked: 3, done: 1, parked: 5, running: 2, scheduled: 4 });
const completeTasks = goalAnswer("Complete tasks", { done: 2 });
const achievedGoal = goalAnswer("Achieved goal", { done: 2 }, { achieved: true });
const anotherAchievedGoal = goalAnswer("Another achieved goal", { done: 2 }, { achieved: true });

pluginPane.it(
	"the goal legend names Done, Running, Blocked, Scheduled and Parked, each in its color",
	[goalsAnswered(shipTheBoard)],
	function* ({ legend }) {
		expect(yield* legend()).toEqual([
			{ color: "#16853f", state: "Done" },
			{ color: "#2879da", state: "Running" },
			{ color: "#d74253", state: "Blocked" },
			{ color: "#ad7400", state: "Scheduled" },
			{ color: "#808080", state: "Parked" },
		]);
	},
);

pluginPane.it(
	"on desktop, Ship the Board's bar is a drawing labelled with its count in each state",
	[goalsAnswered(shipTheBoard)],
	function* ({ goals }) {
		expect(yield* goals()).toEqual(["Ship the Board · drawn 1 of 15 done, 1 done, 2 running, 3 blocked, 4 scheduled, 5 parked · 1/15"]);
	},
);

pluginPane.it(
	"on desktop, Ship the Board's drawing fills its five states in their colors, split by four black boundaries",
	[goalsAnswered(shipTheBoard)],
	function* ({ drawing }) {
		expect(yield* drawing("Ship the Board")).toEqual({
			boundaries: ["#000000", "#000000", "#000000", "#000000"],
			segments: ["#16853f", "#2879da", "#d74253", "#ad7400", "#808080"],
		});
	},
);

pluginPane.it(
	"on a terminal, Ship the Board's bar is a ▰ run per state in its color, sized by the state's share",
	[goalsAnswered(shipTheBoard), onTerminal],
	function* ({ terminalBar }) {
		expect(yield* terminalBar("Ship the Board")).toEqual([
			{ cells: 1, color: "#16853f" },
			{ cells: 1, color: "#2879da" },
			{ cells: 3, color: "#d74253" },
			{ cells: 3, color: "#ad7400" },
			{ cells: 4, color: "#808080" },
		]);
	},
);

pluginPane.it(
	"In flight lists Build the pane, the one started task, and none of the work waiting on a dependency, an area or a slot",
	[workAnswered(buildThePane, waitingOnDependency, waitingOnArea, queuedForSlot)],
	function* ({ inFlight }) {
		expect(yield* inFlight()).toEqual([{ goal: "Other", work: ["Build the pane"] }]);
	},
);

pluginPane.it(
	"Build the pane shows its worker coding for 2m and its reviewer not started yet, with no time",
	[workAnswered(buildThePane)],
	function* ({ agentsOf }) {
		expect(yield* agentsOf("Build the pane")).toEqual(["worker · coding · 2m", "reviewer · not started yet"]);
	},
);

pluginPane.it(
	"a worker turn that finished three days ago shows its own 1m, not the days since it started",
	[workAnswered(finishedTurnDaysAgo)],
	function* ({ agentsOf }) {
		expect(yield* agentsOf("Build the pane")).toEqual(["worker · waiting for CI · 1m"]);
	},
);

pluginPane.it(
	"the band counts no decisions, the one started task of four and 1 of Ship the Board's 15 tasks done",
	[workAnswered(buildThePane, waitingOnDependency, waitingOnArea, queuedForSlot), goalsAnswered(shipTheBoard)],
	function* ({ band }) {
		expect(yield* band()).toBe("Needs you 0 · In flight 1 · Goals 1/15");
	},
);

pluginPane.it("a goal whose tasks are all done shows ✓ all tasks done in place of a bar", [goalsAnswered(completeTasks)], function* ({ goals }) {
	expect(yield* goals()).toEqual(["Complete tasks · ✓ all tasks done · 2/2"]);
});

pluginPane.it(
	"achieved goals fold under Achieved (2), after the open goals",
	[goalsAnswered(achievedGoal, completeTasks, anotherAchievedGoal)],
	function* ({ goals }) {
		expect(yield* goals()).toEqual(["Complete tasks · ✓ all tasks done · 2/2", "▸ Achieved (2)"]);
	},
);

pluginPane.it(
	"opening Achieved (2) lists Achieved goal and Another achieved goal, each ✓ achieved",
	[goalsAnswered(achievedGoal, completeTasks, anotherAchievedGoal)],
	function* ({ click, goals }) {
		expect(yield* goals()).toEqual(["Complete tasks · ✓ all tasks done · 2/2", "▸ Achieved (2)"]);

		yield* click("Achieved (2)");

		expect(yield* goals()).toEqual([
			"Complete tasks · ✓ all tasks done · 2/2",
			"▾ Achieved (2)",
			"Achieved goal · ✓ achieved · 2/2",
			"Another achieved goal · ✓ achieved · 2/2",
		]);
	},
);

pluginPane.it(
	"✓ achieved shows in the Done color, while ✓ all tasks done stays dimmed",
	[goalsAnswered(achievedGoal, completeTasks), achievedOpen],
	function* ({ lookOf }) {
		yield* outcomes({
			"✓ achieved": [lookOf("✓ achieved"), "#16853f"],
			"✓ all tasks done": [lookOf("✓ all tasks done"), "dimmed"],
		});
	},
);

pluginPane.it(
	"when Complete tasks gains a scheduled task, its ✓ all tasks done gives way to a drawing of 2 of 3 done",
	[goalsAnswered(completeTasks)],
	function* ({ goals, taskScheduledIn }) {
		expect(yield* goals()).toEqual(["Complete tasks · ✓ all tasks done · 2/2"]);

		yield* taskScheduledIn("Complete tasks");

		expect(yield* goals()).toEqual(["Complete tasks · drawn 2 of 3 done, 2 done, 0 running, 0 blocked, 1 scheduled, 0 parked · 2/3"]);
	},
);
