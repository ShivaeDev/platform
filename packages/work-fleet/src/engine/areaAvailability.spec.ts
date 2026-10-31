import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mergeWaitIsFiveSeconds } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";

const PR = "https://github.com/example/project/pull/42";

engine.it(
	"a safe release of an area holder empties the area and leaves its waiter queued in it",
	[humanMergeRequired()],
	function* ({ answerDecision, areaLane, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		expect(yield* areaLane("fleet")).toMatchObject({ holders: [{ stage: "waiting", workId: "one" }] });

		yield* answerDecision("one", "release");

		expect(yield* areaLane("fleet")).toEqual({ area: "fleet", holders: [], queue: [{ prUrl: null, stage: "queued", workId: "two" }] });
	},
);

engine.it(
	"dispatching the waiter after a safe release makes it the area's only holder and leaves other areas idle",
	[humanMergeRequired()],
	function* ({ answerDecision, areaLane, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* answerDecision("one", "release");

		yield* fleet.dispatch("two");

		yield* outcomes([
			["fleet", () => areaLane("fleet"), { area: "fleet", holders: [{ prUrl: null, stage: "working", workId: "two" }], queue: [] }],
			["idle", () => areaLane("idle"), { area: "idle", holders: [], queue: [] }],
		]);
	},
);

engine.it(
	"area availability expires at the scheduler's configured merge-wait boundary and admits the waiter",
	[mergeWaitIsFiveSeconds()],
	function* ({ advanceTime, areaLane, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		advanceTime(4999);
		expect(yield* areaLane("fleet")).toMatchObject({ holders: [{ workId: "one" }] });

		advanceTime(1);

		yield* outcomes([
			["fleet", () => areaLane("fleet"), { holders: [] }],
			["two once dispatched", () => fleet.dispatch("two"), { value: { step: "working" } }],
		]);
	},
);

engine.it("a parent area shows the holders of its disjoint child areas", [], function* ({ areaLane, fleet, prepareWork, setAreas }) {
	setAreas("one", ["fleet/host"]);
	setAreas("two", ["fleet/engine"]);
	yield* prepareWork("one");
	yield* prepareWork("two");

	yield* fleet.dispatch("one");
	yield* fleet.dispatch("two");

	expect(yield* areaLane("fleet")).toMatchObject({ holders: [{ workId: "one" }, { workId: "two" }] });
});

engine.it("a wildcard foreign reservation holds every area", [], function* ({ areaLane, reserveForeign }) {
	expect(yield* areaLane("idle")).toEqual({ area: "idle", holders: [], queue: [] });

	yield* reserveForeign(PR, ["*"]);

	expect(yield* areaLane("idle")).toEqual({ area: "idle", holders: [{ prUrl: PR, stage: "external", workId: PR }], queue: [] });
});

engine.it(
	"prepared work leaves its area queue while it waits on a dependency and rejoins once the dependency clears",
	[],
	function* ({ areaLane, attemptDispatch, fleet, prepareWork, setAreas, setDependencies }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		setDependencies("two", ["dependent"]);
		yield* attemptDispatch("two");
		yield* outcomes([
			["two", () => fleet.get("two"), { value: { blocker: expect.stringContaining("waiting for dependency dependent") } }],
			["fleet", () => areaLane("fleet"), { queue: [] }],
		]);

		setDependencies("two", []);

		expect(yield* areaLane("fleet")).toMatchObject({ queue: [{ workId: "two" }] });
	},
);
