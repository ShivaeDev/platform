import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "@shivaedev/work-fleet/test-support/hostStory.ts";
import { fleetOmitsExecution, openPane } from "#test/fleetPane.ts";
import { fiveTasks, paneProject } from "#test/fleetPaneProject.ts";

const FIVE = ["one", "two", "three", "four", "five"];

host.it("board_overview lists approved task.build as Fleet work in flight", [paneProject], function* ({ approve, story }) {
	const { overviewFleet } = yield* openPane(story);
	yield* approve("task.build");

	expect(yield* overviewFleet()).toEqual({ state: "ready", work: [{ title: "Build the pane", workId: "task.build" }] });
});

host.it("the pane shows approved task.build in flight under its goal Ship the pane", [paneProject], function* ({ approve, story }) {
	const { inFlight } = yield* openPane(story);
	yield* approve("task.build");

	expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);
});

host.it("the pane shows approved task.build's worker coding and its reviewer not started yet", [paneProject], function* ({ approve, story }) {
	const { agentsOf } = yield* openPane(story);
	yield* approve("task.build");

	expect(yield* agentsOf("Build the pane")).toEqual(["worker · coding", "reviewer · not started yet"]);
});

host.it("Ship the pane's drawing counts approved task.build as running", [paneProject], function* ({ approve, story }) {
	const { goals } = yield* openPane(story);
	yield* approve("task.build");

	expect(yield* goals()).toEqual(["Ship the pane · drawn 0 of 1 done, 0 done, 1 running, 0 blocked, 0 scheduled, 0 parked · 0/1"]);
});

host.it(
	"after task.build's worker asks for an answer, the pane shows the worker waiting on an answer",
	[paneProject],
	function* ({ approve, askWorker, story }) {
		const { agentsOf } = yield* openPane(story);
		yield* approve("task.build");
		expect(yield* agentsOf("Build the pane")).toEqual(["worker · coding", "reviewer · not started yet"]);

		yield* askWorker("task.build");

		expect(yield* agentsOf("Build the pane")).toEqual(["worker · waiting on an answer", "reviewer · not started yet"]);
	},
);

host.it(
	"after task.build's worker asks for an answer, the pane keeps task.build in flight under Ship the pane and running in its drawing",
	[paneProject],
	function* ({ approve, askWorker, story }) {
		const { goals, inFlight } = yield* openPane(story);
		yield* approve("task.build");

		yield* askWorker("task.build");

		yield* outcomes({
			"Goals": [goals(), ["Ship the pane · drawn 0 of 1 done, 0 done, 1 running, 0 blocked, 0 scheduled, 0 parked · 0/1"]],
			"In flight": [inFlight(), [{ goal: "Ship the pane", work: ["Build the pane"] }]],
		});
	},
);

host.it(
	"board_overview lists all five approved tasks when Fleet's reply omits execution details",
	[paneProject, fiveTasks, fleetOmitsExecution],
	function* ({ approve, story }) {
		const { overviewFleet } = yield* openPane(story);
		for (const id of FIVE) {
			yield* approve(`task.${id}`);
		}

		expect(yield* overviewFleet()).toEqual({
			state: "ready",
			work: FIVE.map((id) => ({ title: `Build ${id}`, workId: `task.${id}` })),
		});
	},
);

host.it(
	"the pane lists all five approved tasks in flight under Ship the pane when Fleet's reply omits execution details",
	[paneProject, fiveTasks, fleetOmitsExecution],
	function* ({ approve, story }) {
		const { inFlight } = yield* openPane(story);
		for (const id of FIVE) {
			yield* approve(`task.${id}`);
		}

		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: FIVE.map((id) => `Build ${id}`) }]);
	},
);

host.it(
	"once the Fleet daemon stops, board_overview reports Fleet unavailable with the Board's reason",
	[paneProject],
	function* ({ approve, story }) {
		const { overviewFleet, stopFleet } = yield* openPane(story);
		yield* approve("task.build");
		expect(yield* overviewFleet()).toEqual({ state: "ready", work: [{ title: "Build the pane", workId: "task.build" }] });

		yield* stopFleet();

		expect(yield* overviewFleet()).toEqual({ reason: "Fleet isn't running, so agent work and its health are unknown.", state: "unavailable" });
	},
);

host.it(
	"once the Fleet daemon stops, the pane's In flight says Fleet is unavailable in place of task.build",
	[paneProject],
	function* ({ approve, story }) {
		const { inFlight, stopFleet } = yield* openPane(story);
		yield* approve("task.build");
		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);

		yield* stopFleet();

		expect(yield* inFlight()).toBe("Fleet is unavailable: Fleet isn't running, so agent work and its health are unknown.");
	},
);

host.it("after the Fleet daemon restarts on its port, the pane shows task.build in flight again", [paneProject], function* ({ approve, story }) {
	const { inFlight, restartFleet, stopFleet } = yield* openPane(story);
	yield* approve("task.build");
	yield* stopFleet();
	expect(yield* inFlight()).toBe("Fleet is unavailable: Fleet isn't running, so agent work and its health are unknown.");

	yield* restartFleet();

	expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);
});
