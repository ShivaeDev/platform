import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetOmitsExecution, pluginFleet } from "#test/fleetPane.ts";
import { fiveTasks, paneProject } from "#test/fleetPaneProject.ts";

const FIVE = ["one", "two", "three", "four", "five"];

pluginFleet.it("board_overview lists approved task.build as Fleet work in flight", [paneProject], function* ({ approve, openPane }) {
	const { refresh, overviewFleet } = yield* openPane();
	yield* approve("task.build");

	yield* refresh();

	expect(yield* overviewFleet()).toEqual({ state: "ready", work: [{ title: "Build the pane", workId: "task.build" }] });
});

pluginFleet.it("the pane shows approved task.build in flight under its goal Ship the pane", [paneProject], function* ({ approve, openPane }) {
	const { refresh, inFlight } = yield* openPane();
	yield* approve("task.build");

	yield* refresh();

	expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);
});

pluginFleet.it(
	"the pane shows approved task.build's worker coding and its reviewer not started yet",
	[paneProject],
	function* ({ approve, openPane }) {
		const { refresh, agentsOf } = yield* openPane();
		yield* approve("task.build");

		yield* refresh();

		expect(yield* agentsOf("Build the pane")).toEqual(["worker · coding", "reviewer · not started yet"]);
	},
);

pluginFleet.it("Ship the pane's drawing counts approved task.build as running", [paneProject], function* ({ approve, openPane }) {
	const { refresh, goals } = yield* openPane();
	yield* approve("task.build");

	yield* refresh();

	expect(yield* goals()).toEqual(["Ship the pane · drawn 0 of 1 done, 0 done, 1 running, 0 blocked, 0 scheduled, 0 parked · 0/1"]);
});

pluginFleet.it(
	"after task.build's worker asks for an answer, the pane shows the worker waiting on an answer",
	[paneProject],
	function* ({ approve, askWorker, openPane }) {
		const { refresh, agentsOf } = yield* openPane();
		yield* approve("task.build");
		yield* refresh();

		expect(yield* agentsOf("Build the pane")).toEqual(["worker · coding", "reviewer · not started yet"]);

		yield* askWorker("task.build");

		yield* refresh();

		expect(yield* agentsOf("Build the pane")).toEqual(["worker · waiting on an answer", "reviewer · not started yet"]);
	},
);

pluginFleet.it(
	"after task.build's worker asks for an answer, the pane keeps task.build in flight under Ship the pane and running in its drawing",
	[paneProject],
	function* ({ approve, askWorker, openPane }) {
		const { refresh, goals, inFlight } = yield* openPane();
		yield* approve("task.build");

		yield* askWorker("task.build");

		yield* refresh();

		yield* outcomes([
			["Goals", () => goals(), ["Ship the pane · drawn 0 of 1 done, 0 done, 1 running, 0 blocked, 0 scheduled, 0 parked · 0/1"]],
			["In flight", () => inFlight(), [{ goal: "Ship the pane", work: ["Build the pane"] }]],
		]);
	},
);

pluginFleet.it(
	"board_overview lists all five approved tasks when Fleet's reply omits execution details",
	[paneProject, fiveTasks, fleetOmitsExecution],
	function* ({ approve, openPane }) {
		const { refresh, overviewFleet } = yield* openPane();
		for (const id of FIVE) {
			yield* approve(`task.${id}`);
		}

		yield* refresh();

		expect(yield* overviewFleet()).toEqual({
			state: "ready",
			work: FIVE.map((id) => ({ title: `Build ${id}`, workId: `task.${id}` })),
		});
	},
);

pluginFleet.it(
	"the pane lists all five approved tasks in flight under Ship the pane when Fleet's reply omits execution details",
	[paneProject, fiveTasks, fleetOmitsExecution],
	function* ({ approve, openPane }) {
		const { refresh, inFlight } = yield* openPane();
		for (const id of FIVE) {
			yield* approve(`task.${id}`);
		}

		yield* refresh();

		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: FIVE.map((id) => `Build ${id}`) }]);
	},
);

pluginFleet.it(
	"once the Fleet daemon stops, board_overview reports Fleet unavailable with the Board's reason",
	[paneProject],
	function* ({ approve, openPane }) {
		const { refresh, overviewFleet, stopFleet } = yield* openPane();
		yield* approve("task.build");
		yield* refresh();

		expect(yield* overviewFleet()).toEqual({ state: "ready", work: [{ title: "Build the pane", workId: "task.build" }] });

		yield* stopFleet();

		yield* refresh();

		expect(yield* overviewFleet()).toEqual({ reason: "Fleet isn't running, so agent work and its health are unknown.", state: "unavailable" });
	},
);

pluginFleet.it(
	"after Fleet stops, the pane keeps its last flight until Refresh shows Fleet unavailable",
	[paneProject],
	function* ({ approve, openPane }) {
		const { refresh, inFlight, stopFleet } = yield* openPane();
		yield* approve("task.build");
		yield* refresh();

		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);

		yield* stopFleet();

		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);

		yield* refresh();

		expect(yield* inFlight()).toBe("Fleet is unavailable: Fleet isn't running, so agent work and its health are unknown.");
	},
);

pluginFleet.it(
	"after the Fleet daemon restarts on its port, the pane shows task.build in flight again",
	[paneProject],
	function* ({ approve, openPane }) {
		const { refresh, inFlight, restartFleet, stopFleet } = yield* openPane();
		yield* approve("task.build");
		yield* stopFleet();
		yield* refresh();

		expect(yield* inFlight()).toBe("Fleet is unavailable: Fleet isn't running, so agent work and its health are unknown.");

		yield* restartFleet();

		yield* refresh();

		expect(yield* inFlight()).toEqual([{ goal: "Ship the pane", work: ["Build the pane"] }]);
	},
);
