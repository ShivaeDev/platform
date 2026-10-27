import { expect } from "vitest";
import { host } from "@shivaedev/work-fleet/test-support/hostStory.ts";
import { fleetPane } from "#test/fleetPane.ts";
import { fiveTasks, paneProject } from "#test/fleetPaneProject.ts";
import { legacyFleetBoard } from "#test/legacyFleetBoard.ts";

host.it(
	"keeps real Fleet work in flight and in its goal when a worker asks for an answer",
	[paneProject],
	function* ({ approve, askWorker, boardHttp, story }) {
		yield* approve("task.build");
		const board = yield* boardHttp();
		const pane = yield* fleetPane(board.url, story.engine.fixture.host.boardDir);
		const overview = yield* pane.overview();
		expect(overview.fleet).toMatchObject({ items: [{ title: "Build the pane", workId: "task.build" }], state: "ready" });
		const parsed = yield* pane.refresh();
		expect(parsed).toMatchObject({ flights: { items: [{ workId: "task.build" }] }, goals: { items: [{ running: 1 }] } });
		expect(pane.screen().textContent).toContain("In flight(1)");
		expect(pane.screen().textContent).toContain("worker · coding");
		expect(pane.screen().querySelector("[role=img]")?.getAttribute("aria-label")).toContain("1 running");
		yield* askWorker("task.build");
		const waiting = yield* pane.refresh();
		expect(waiting).toMatchObject({ flights: { items: [{ workId: "task.build" }] }, goals: { items: [{ running: 1 }] } });
		expect(pane.screen().textContent).toContain("worker · waiting on an answer");
	},
);

host.it("lists all five running tasks when Fleet's wire reply omits execution details", [paneProject, fiveTasks], function* ({ approve, story }) {
	for (const id of ["one", "two", "three", "four", "five"]) {
		yield* approve(`task.${id}`);
	}
	const board = yield* legacyFleetBoard(story.engine);
	const pane = yield* fleetPane(board.url, story.engine.fixture.host.boardDir);
	const overview = yield* pane.overview();
	expect(overview.fleet.state).toBe("ready");
	if (!("items" in overview.fleet)) {
		throw new Error("Fleet is unavailable");
	}
	expect(overview.fleet.items.map((item) => item.workId).sort()).toEqual(["task.five", "task.four", "task.one", "task.three", "task.two"]);
	expect(yield* pane.refresh()).toMatchObject({ flights: { items: expect.any(Array) }, goals: { items: [{ running: 5 }] } });
	expect(pane.screen().textContent).toContain("In flight(5)");
	for (const id of ["one", "two", "three", "four", "five"]) {
		expect(pane.screen().textContent).toContain(`Build ${id}`);
	}
	expect(pane.screen().querySelector("[role=img]")?.getAttribute("aria-label")).toContain("5 running");
});

host.it("reports an unreachable Fleet in the overview and pane", [paneProject], function* ({ approve, boardHttp, stop, start, port, story }) {
	yield* approve("task.build");
	const board = yield* boardHttp();
	const pane = yield* fleetPane(board.url, story.engine.fixture.host.boardDir);
	const fleetPort = port();
	yield* stop();
	expect((yield* pane.overview()).fleet).toMatchObject({ state: "unavailable" });
	yield* pane.refresh();
	expect(pane.screen().textContent).toContain("Fleet is unavailable:");
	expect(pane.screen().textContent).not.toContain("Nothing in flight.");
	yield* start(fleetPort);
	expect(yield* pane.refresh()).toMatchObject({ flights: { items: [{ workId: "task.build" }], problem: null }, goals: { items: [{ running: 1 }] } });
});
