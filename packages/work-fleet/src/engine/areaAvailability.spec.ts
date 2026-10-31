import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { mergeWaitIsFiveSeconds } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";

engine.it(
	"safe release moves an area holder into free capacity for its first waiter",
	[humanMergeRequired()],
	function* ({ fleet, setAreas, prepareWork, finishWorkers, respond }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const waiting = yield* fleet.reconcile("one");
		const before = yield* fleet.areaLanes(["fleet", "idle"]);
		expect(before.find((area) => area.area === "fleet")?.holders).toMatchObject([{ stage: "waiting", workId: "one" }]);
		const decision = waiting.value.decision?.id ?? "missing";
		yield* fleet.resolve("one", decision, respond(decision, "release"));
		const released = yield* fleet.areaLanes(["fleet", "idle"]);
		expect(released.find((area) => area.area === "fleet")).toEqual({
			area: "fleet",
			holders: [],
			queue: [{ prUrl: null, stage: "queued", workId: "two" }],
		});
		yield* fleet.dispatch("two");
		const after = yield* fleet.areaLanes(["fleet", "idle"]);
		expect(after.find((area) => area.area === "fleet")?.holders).toEqual([{ prUrl: null, stage: "working", workId: "two" }]);
		expect(after.find((area) => area.area === "fleet")?.queue).toEqual([]);
		expect(after.find((area) => area.area === "idle")).toEqual({ area: "idle", holders: [], queue: [] });
	},
);

engine.it(
	"area availability expires at the scheduler's configured merge-wait boundary",
	[mergeWaitIsFiveSeconds()],
	function* ({ fleet, setAreas, prepareWork, finishWorkers, advanceTime }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		advanceTime(4999);
		expect((yield* fleet.areaLanes(["fleet"]))[0]?.holders.map((task) => task.workId)).toEqual(["one"]);
		advanceTime(1);
		expect((yield* fleet.areaLanes(["fleet"]))[0]?.holders).toEqual([]);
		const started = yield* fleet.dispatch("two");
		expect(started.value.step).toBe("working");
	},
);

engine.it(
	"parent areas show disjoint child holders and wildcard reservations hold every area",
	[],
	function* ({ fleet, setAreas, prepareWork, reserveForeign }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/engine"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		yield* fleet.dispatch("two");
		const children = yield* fleet.areaLanes(["fleet"]);
		expect(children.find((area) => area.area === "fleet")?.holders.map((task) => task.workId)).toEqual(["one", "two"]);
		const url = "https://github.com/example/project/pull/42";
		yield* reserveForeign(url, ["*"]);
		expect((yield* fleet.areaLanes(["idle"])).find((area) => area.area === "idle")?.holders).toEqual([
			{ prUrl: url, stage: "external", workId: url },
		]);
	},
);

engine.it(
	"prepared tasks waiting on dependencies leave the area queue until eligible",
	[],
	function* ({ fleet, setAreas, setDependencies, prepareWork }) {
		setAreas("one", ["fleet"]);
		setAreas("two", ["fleet"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		setDependencies("two", ["dependent"]);
		yield* fleet.dispatch("two").pipe(Effect.result);
		yield* outcomes([
			[
				"Dependency wait",
				() => fleet.get("two").pipe(Effect.map((stored) => stored.value.blocker)),
				expect.stringContaining("waiting for dependency dependent"),
			],
			["Area queue", () => fleet.areaLanes(["fleet"]).pipe(Effect.map((areas) => areas[0]?.queue)), []],
		]);
		setDependencies("two", []);
		expect((yield* fleet.areaLanes(["fleet"]))[0]?.queue.map((task) => task.workId)).toEqual(["two"]);
	},
);
