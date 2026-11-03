import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reconciliation } from "#test/reconciliation.ts";

reconciliation.it(
	"a failure recording error retains both the worker defect and SQL cause",
	[],
	function* ({ start, break: breakWorker, loseFailureStorage, refresh, failed, failure }) {
		yield* start("tasks");
		yield* breakWorker("tasks");
		yield* loseFailureStorage();

		yield* refresh("tasks");
		yield* failed("tasks");

		expect(yield* failure("tasks")).toMatch(/tasks broke[\s\S]*relation "failures" does not exist/u);
	},
);

reconciliation.it("a blocked action reports running and completing it reports waiting", [], function* ({ startBlocked, state, release, settled }) {
	yield* startBlocked("tasks");
	expect(yield* state("tasks")).toEqual({ status: "running" });

	yield* release("tasks");
	yield* settled("tasks");

	expect(yield* state("tasks")).toEqual({ nextDue: undefined, status: "waiting" });
});

reconciliation.it(
	"a defect fails one reconciler with its cause while another keeps running",
	[],
	function* ({ start, break: breakWorker, commit, failed, settled, failure, passes, state }) {
		yield* start("broken");
		yield* start("healthy");
		yield* breakWorker("broken");

		yield* commit("changed");
		yield* failed("broken");
		yield* settled("healthy");

		yield* outcomes([
			["failure cause", () => failure("broken"), expect.stringContaining("broken broke")],
			["failed state", () => state("broken"), { status: "failed" }],
			["healthy actions", () => passes("healthy"), [["initial"], ["changed"]]],
		]);
	},
);

reconciliation.it(
	"resume restarts a failed reconciler from current data and retains its SQL failure record",
	[],
	function* ({ start, break: breakWorker, commit, failed, recover, resume, settled, passes, storedFailures }) {
		yield* start("tasks");
		yield* breakWorker("tasks");
		yield* commit("broken");
		yield* failed("tasks");
		yield* commit("current");
		yield* recover("tasks");

		yield* resume("tasks");
		yield* settled("tasks");

		yield* outcomes([
			["actions", () => passes("tasks"), [["initial"], ["broken"], ["current"]]],
			["stored failures", () => storedFailures(), [{ cause: expect.stringContaining("tasks broke"), name: "tasks" }]],
		]);
	},
);

reconciliation.it(
	"a typed failure survives in the await error channel",
	[],
	function* ({ start, break: breakWorker, refresh, failed, typedFailure }) {
		yield* start("tasks");
		yield* breakWorker("tasks", "typed");

		yield* refresh("tasks");
		yield* failed("tasks");

		expect(yield* typedFailure("tasks")).toBe("tasks refused");
	},
);

reconciliation.it(
	"closing a scope interrupts its reconciler without recording a failure or retaining its timer",
	[],
	function* ({ start, dueIn, settled, close, interrupted, advance, queries, storedFailures }) {
		yield* start("tasks");
		yield* dueIn(1000);
		yield* settled("tasks");

		yield* close("tasks");
		yield* advance("1 day");

		yield* outcomes([
			["termination", () => interrupted("tasks"), true],
			["query snapshots", () => queries("tasks"), [["initial"], ["initial"]]],
			["stored failures", () => storedFailures(), []],
		]);
	},
);
