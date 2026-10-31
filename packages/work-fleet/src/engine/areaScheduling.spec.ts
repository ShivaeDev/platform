import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";

isolatedEngine.it(
	"a renewed revision queues behind the existing area waiters",
	[noChangeReported()],
	function* ({ approveWork, attemptDispatch, editWork, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		editWork("one", "renewed-revision");
		approveWork("one", "renewed-revision");

		yield* prepareWork("one");

		expect(yield* attemptDispatch("one")).toContain("queued ahead by two");
		const second = yield* fleet.dispatch("two");
		expect(second.value.step).toBe("working");
	},
);

isolatedEngine.it(
	"overlapping areas let one of two concurrent dispatches launch and admit the other once it completes",
	[],
	function* ({ dispatchTogether, finishWorkers, fleet, launchedPrompts, prepareWork, setAreas, workState }) {
		setAreas("one", ["fleet/host", "board/ui"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");

		yield* dispatchTogether("one", "two");

		yield* outcomes([
			["launched prompts", () => launchedPrompts(), ["Implement one"]],
			["two", () => workState("two"), { blocker: "waiting for area fleet/host held by one", step: "queued" }],
		]);
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		const next = yield* fleet.dispatch("two");
		expect(next.value.step).toBe("working");
		expect(next.value.blocker).toBeUndefined();
	},
);

isolatedEngine.it("disjoint areas dispatch concurrently", [], function* ({ dispatchTogether, launches, prepareWork, setAreas }) {
	setAreas("one", ["fleet/host"]);
	setAreas("two", ["board/ui"]);
	yield* prepareWork("one");
	yield* prepareWork("two");

	const steps = yield* dispatchTogether("one", "two");

	expect(steps).toEqual(["working", "working"]);
	expect(launches().toSorted()).toEqual(["operation-1", "operation-2"]);
});

isolatedEngine.it(
	"a human release of the area holder frees the area",
	[humanMergeRequired()],
	function* ({ attemptDispatch, finishWorkers, fleet, prepareWork, respond, setAreas, stepOf }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const holder = yield* fleet.reconcile("one");
		const decision = holder.value.decision?.id ?? "missing";
		expect(yield* attemptDispatch("two")).toBe("admission refused: waiting for area fleet/host held by one");

		yield* fleet.resolve("one", decision, respond(decision, "release"));

		yield* outcomes([
			["one", () => stepOf("one"), "released"],
			["two once dispatched", () => fleet.dispatch("two"), { value: { step: "working" } }],
		]);
	},
);

isolatedEngine.it(
	"after a restart, racing dispatchers launch the waiters once each in their original order",
	[],
	function* ({
		blockerOf,
		dispatchTogether,
		finishWorkers,
		fleet,
		get,
		launchedPrompts,
		prepareWork,
		restart,
		schedule,
		setAreas,
		setDependencies,
		workStages,
	}) {
		for (const id of ["one", "two", "dependent"]) {
			setAreas(id, ["fleet/host"]);
			setDependencies(id, []);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		yield* schedule();
		yield* outcomes([
			["two", () => blockerOf("two"), expect.stringContaining("held by one")],
			["dependent", () => blockerOf("dependent"), expect.stringContaining("held by one")],
		]);
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* restart();

		yield* dispatchTogether("dependent", "two", "two");

		// Racing preparation writes can require the scheduler's next pass.
		yield* schedule();
		yield* outcomes([
			["stages", () => workStages(["two", "dependent"]), { dependent: "queued", two: "working" }],
			["attempts on two", () => get("two"), { value: { attempts: [{ prompt: "Implement two", role: "worker" }] } }],
		]);
		finishWorkers();
		yield* fleet.reconcile("two");
		yield* schedule();
		yield* outcomes([
			["dependent", () => workStages(["dependent"]), { dependent: "working" }],
			["launched prompts", () => launchedPrompts(), ["Implement one", "Implement two", "Implement dependent"]],
		]);
	},
);
