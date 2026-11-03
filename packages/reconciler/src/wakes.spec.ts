import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reconciliation } from "#test/reconciliation.ts";

reconciliation.it(
	"a change during the first read is already subscribed and schedules a fresh pass",
	[],
	function* ({ startReading, commit, releaseRead, settled, passes }) {
		yield* startReading("tasks");

		yield* commit("current");
		yield* releaseRead("tasks");
		yield* settled("tasks");
		yield* settled("tasks");

		expect(yield* passes("tasks")).toEqual([["initial"], ["current"]]);
	},
);

reconciliation.it("a committed change wakes one pass that reads the committed state", [], function* ({ start, commit, settled, passes, queries }) {
	yield* start("tasks");
	expect(yield* passes("tasks")).toEqual([["initial"]]);

	yield* commit("committed");
	yield* settled("tasks");

	yield* outcomes([
		["actions", () => passes("tasks"), [["initial"], ["committed"]]],
		["query snapshots", () => queries("tasks"), [["initial"], ["committed"]]],
	]);
});

reconciliation.it("a rolled-back change wakes no pass or query", [], function* ({ start, rollback, advance, passes, queries }) {
	yield* start("tasks");

	yield* rollback("discarded");
	yield* advance("1 day");

	yield* outcomes([
		["actions", () => passes("tasks"), [["initial"]]],
		["query snapshots", () => queries("tasks"), [["initial"]]],
	]);
});

reconciliation.it(
	"changes during a pass merge into one more pass reading current state",
	[],
	function* ({ startBlocked, commit, release, settled, passes, queries }) {
		yield* startBlocked("tasks");

		yield* commit("first");
		yield* commit("latest");
		yield* release("tasks");
		yield* settled("tasks");
		yield* settled("tasks");

		yield* outcomes([
			["actions", () => passes("tasks"), [["initial"], ["latest"]]],
			["query snapshots", () => queries("tasks"), [["initial"], ["latest"]]],
		]);
	},
);

reconciliation.it("an idle reconciler runs no query while a day passes without changes", [], function* ({ start, advance, queries }) {
	yield* start("tasks");
	expect(yield* queries("tasks")).toEqual([["initial"]]);

	yield* advance("1 day");

	expect(yield* queries("tasks")).toEqual([["initial"]]);
});

reconciliation.it("a reported due time wakes a pass without a data change", [], function* ({ start, dueIn, settled, advance, state, queries }) {
	yield* start("tasks");
	yield* dueIn(1000);
	yield* settled("tasks");
	expect(yield* state("tasks")).toEqual({ nextDue: 1000, status: "waiting" });

	yield* advance("1 second");
	yield* settled("tasks");

	yield* outcomes([
		["query snapshots", () => queries("tasks"), [["initial"], ["initial"], ["initial"]]],
		["waiting state", () => state("tasks"), { nextDue: undefined, status: "waiting" }],
	]);
});
