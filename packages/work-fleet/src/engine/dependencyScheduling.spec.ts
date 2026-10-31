import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"a dependency chain held by automation launches in order, each link after its predecessor completes across restarts",
	[noChangeReported()],
	function* ({ finishWorkers, fleet, get, launchedPrompts, prepareWork, restart, schedule, setDependencies }) {
		setDependencies("two", ["one"]);
		setDependencies("dependent", ["two"]);
		for (const id of ["dependent", "two", "one"]) {
			yield* prepareWork(id);
		}
		yield* schedule();
		yield* outcomes([
			["two", () => get("two"), { value: { attentionOwner: "automation", blocker: expect.stringContaining("waiting for dependency one") } }],
			["dependent", () => get("dependent"), { value: { blocker: expect.stringContaining("waiting for dependency two") } }],
		]);

		for (const id of ["one", "two"]) {
			finishWorkers();
			expect((yield* fleet.reconcile(id)).value.step).toBe("done");
			yield* restart();
			yield* schedule();
		}

		expect(yield* launchedPrompts()).toEqual(["Implement one", "Implement two", "Implement dependent"]);
	},
);

engine.it(
	"a dependency done on the Board with no Fleet record qualifies its dependent",
	[],
	function* ({ attemptDispatch, fleet, prepareWork, setBoardStatus, setDependencies }) {
		setDependencies("dependent", ["external"]);
		yield* prepareWork("dependent");
		expect(yield* attemptDispatch("dependent")).toMatch(/^forbidden: .*not done on the Board/u);

		setBoardStatus("external", "done");

		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
	},
);

engine.it(
	"a dependency done on the Board qualifies its dependent once its prepared Fleet work releases",
	[],
	function* ({ attemptDispatch, fleet, prepareWork, setBoardStatus, setDependencies, stepOf }) {
		setDependencies("two", ["one"]);
		setBoardStatus("one", "done");
		yield* prepareWork("one");
		yield* prepareWork("two");
		expect(yield* attemptDispatch("two")).toMatch(/^forbidden: .*Fleet work is still active \(queued\)/u);

		yield* fleet.dispatch("one");

		yield* outcomes([
			["one", () => stepOf("one"), "released"],
			["two once dispatched", () => fleet.dispatch("two"), { value: { step: "working" } }],
		]);
	},
);

engine.it(
	"a dependency sharing an area with its earlier-queued dependent launches first, and the dependent follows it",
	[],
	function* ({ attemptDispatch, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("dependent", ["fleet/host"]);
		setAreas("one", ["fleet/host"]);
		yield* prepareWork("dependent");
		yield* prepareWork("one");
		expect(yield* attemptDispatch("dependent")).toMatch(/^forbidden: /u);

		const dependency = yield* fleet.dispatch("one");

		expect(dependency.value.step).toBe("working");
		finishWorkers();
		yield* fleet.reconcile("one");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
	},
);
