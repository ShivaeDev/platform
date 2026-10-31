import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { isolatedEngine } from "#test/engineStory.ts";

isolatedEngine.it(
	"a waiter blocked on one of its areas leaves its other area to later work",
	[],
	function* ({ approveWork, attemptsOf, blockerOf, fleet, launchedPrompts, prepareWork, schedule, setAreas, workStages }) {
		setAreas("one", ["docs/framework/quickstart"]);
		setAreas("two", ["docs/framework/quickstart", "platform/auth"]);
		setAreas("later", ["platform/auth"]);
		for (const id of ["one", "two", "later"]) {
			approveWork(id, `board-${id}`);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");

		yield* schedule();

		yield* outcomes([
			["two", () => blockerOf("two"), "waiting for area docs/framework/quickstart held by one"],
			["attempts on two", () => attemptsOf("two"), 0],
			["stages", () => workStages(["two", "later"]), { later: "working", two: "queued" }],
			["launched prompts", () => launchedPrompts(), ["Implement one", "Implement later"]],
		]);
	},
);

isolatedEngine.it(
	"free-area contenders launch by priority and keep queue order within a priority",
	[],
	function* ({ approveWork, attemptDispatch, finishWorker, fleet, launchedPrompts, prepareWork, schedule, setAreas, setPriority, workStages }) {
		for (const id of ["one", "two", "later"]) {
			approveWork(id, `board-${id}`);
			setAreas(id, ["shared"]);
			yield* prepareWork(id);
		}
		setPriority("two", "high");
		setPriority("later", "high");
		yield* outcomes([
			["dispatching one", () => attemptDispatch("one"), "admission refused: waiting for area shared queued ahead by two"],
			["dispatching later", () => attemptDispatch("later"), "admission refused: waiting for area shared queued ahead by two"],
		]);

		yield* schedule();

		expect(yield* workStages(["one", "two", "later"])).toEqual({ later: "queued", one: "queued", two: "working" });
		yield* finishWorker("two");
		yield* fleet.reconcile("two");
		yield* schedule();
		yield* outcomes([
			["later", () => workStages(["later"]), { later: "working" }],
			["launched prompts", () => launchedPrompts(), ["Implement two", "Implement later"]],
		]);
	},
);

isolatedEngine.it(
	"a waiter blocked by a foreign area holder leaves its other area to later work",
	[],
	function* ({ attemptsOf, blockerOf, prepareWork, reserveForeign, schedule, setAreas, workStages }) {
		yield* reserveForeign("external", ["area-a"]);
		setAreas("one", ["area-a", "area-b"]);
		setAreas("two", ["area-b"]);
		yield* prepareWork("one");
		yield* prepareWork("two");

		yield* schedule();

		yield* outcomes([
			["one", () => blockerOf("one"), "waiting for area area-a held by external"],
			["attempts on one", () => attemptsOf("one"), 0],
			["stages", () => workStages(["one", "two"]), { one: "queued", two: "working" }],
		]);
	},
);

for (const priority of ["urgent", "high"] as const) {
	isolatedEngine.it(
		`a blocked ${priority} waiter launches ahead of lower-priority contenders when its area frees`,
		[],
		function* ({ approveWork, blockerOf, finishWorker, fleet, launchedPrompts, prepareWork, schedule, setAreas, setPriority, workStages }) {
			for (const id of ["one", "two", "waiter"]) {
				approveWork(id, `board-${id}`);
				setAreas(id, ["shared"]);
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			setPriority("waiter", priority);
			yield* schedule();
			expect(yield* blockerOf("waiter")).toBe("waiting for area shared held by one");
			approveWork("later", "board-later");
			setAreas("later", ["shared"]);
			yield* prepareWork("later");
			yield* finishWorker("one");
			yield* fleet.reconcile("one");

			yield* schedule();

			yield* outcomes([
				["stages", () => workStages(["waiter", "two", "later"]), { later: "queued", two: "queued", waiter: "working" }],
				["launched prompts", () => launchedPrompts(), ["Implement one", "Implement waiter"]],
			]);
		},
	);
}

isolatedEngine.it(
	"a waiter blocked on a dependency leaves its areas to later work",
	[],
	function* ({ attemptsOf, blockerOf, prepareWork, schedule, setAreas, setDependencies, workStages }) {
		setAreas("one", ["shared"]);
		setDependencies("one", ["dependency"]);
		setAreas("two", ["shared"]);
		yield* prepareWork("one");
		yield* prepareWork("two");

		yield* schedule();

		yield* outcomes([
			["one", () => blockerOf("one"), expect.stringContaining("waiting for dependency dependency")],
			["attempts on one", () => attemptsOf("one"), 0],
			["stages", () => workStages(["one", "two"]), { one: "queued", two: "working" }],
		]);
	},
);
