import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { closedGoalPageFixture, goalPageFixture } from "#test/goalPageFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen } from "#test/screenTraits.ts";
import { DocumentMain } from "./DocumentMain.tsx";

const quiet: Readonly<Record<string, string>> = { ...goalPageFixture(), "asks.md": "# No open asks" };

screenStory.it(
	"a goal page groups linked work by its authored state and lists only the groups that hold work",
	[boardScreen(quiet, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ linkedWork }) {
		expect(yield* linkedWork()).toEqual({
			Deferred: ["task.third"],
			Done: ["task.fourth"],
			Draft: ["task.fifth", "task.first", "task.second"],
		});
	},
);

screenStory.it(
	"without Fleet, linked work shows its authored state and a task that implements the whole goal names no criterion",
	[boardScreen(quiet, (api) => <DocumentMain api={api} onPage={() => undefined} url="/goal.md" />)],
	function* ({ criterionCard, linkedWorkRow }) {
		yield* outcomes({
			"fifth task": [linkedWorkRow("task.fifth"), expect.objectContaining({ criteria: "empty", group: "Draft" })],
			"first criterion": [criterionCard("first"), expect.objectContaining({ progress: expect.stringContaining("2 parked") })],
			"first task": [linkedWorkRow("task.first"), expect.objectContaining({ criteria: "first", states: ["Draft"] })],
			"third task": [linkedWorkRow("task.third"), expect.objectContaining({ group: "Deferred", states: ["Deferred"] })],
		});
	},
);

screenStory.it(
	"a goal without linked work says so instead of showing zero progress",
	[boardScreen(goalPageFixture(), (api) => <DocumentMain api={api} onPage={() => undefined} url="/empty.md" />)],
	function* ({ goalOpenAsks, goalPageStateCounts, goalProgressNotice, linkedWork }) {
		yield* outcomes({
			"linked work": [linkedWork(), {}],
			"linked work by state": [goalPageStateCounts(), []],
			"open asks": [goalOpenAsks(), "none"],
			progress: [goalProgressNotice(), "No linked work"],
		});
	},
);

for (const status of ["done", "dropped"]) {
	screenStory.it(
		`a ${status} goal's page counts its linked tasks, asks and criteria like an open goal's`,
		[boardScreen(closedGoalPageFixture(status), (api) => <DocumentMain api={api} onPage={() => undefined} url="/closed.md" />)],
		function* ({ criterionCard, goalOpenAsks, goalPageStateCounts, linkedWorkItems }) {
			yield* outcomes({
				"first criterion": [criterionCard("first"), expect.objectContaining({ progress: "1 blocked · 1 parked" })],
				"linked work": [linkedWorkItems(), expect.not.arrayContaining(["result.closed"])],
				"linked work by state": [goalPageStateCounts(), ["1 done", "0 running (quiet)", "2 blocked", "0 scheduled (quiet)", "2 parked"]],
				"open asks": [goalOpenAsks(), "3 open asks"],
			});
		},
	);
}
