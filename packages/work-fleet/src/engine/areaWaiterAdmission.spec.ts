import { Effect } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";

isolatedEngine.it(
	"a waiter blocked on area A leaves area B available to later work",
	[],
	function* ({ approveWork, setAreas, prepareWork, fleet, schedule, get, providerStarts }) {
		setAreas("one", ["docs/framework/quickstart"]);
		setAreas("two", ["docs/framework/quickstart", "platform/auth"]);
		setAreas("later", ["platform/auth"]);
		for (const id of ["one", "two", "later"]) {
			approveWork(id, `board-${id}`);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		yield* schedule();
		expect((yield* get("two")).value).toMatchObject({
			attempts: [],
			blocker: "waiting for area docs/framework/quickstart held by one",
			step: "queued",
		});
		expect((yield* get("later")).value.step).toBe("working");
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one", "Implement later"]);
	},
);

isolatedEngine.it(
	"free-area contenders launch by priority and retain queue order within a priority",
	[],
	function* ({ approveWork, setAreas, setPriority, prepareWork, schedule, get, finishWorker, fleet, providerStarts }) {
		for (const id of ["one", "two", "later"]) {
			approveWork(id, `board-${id}`);
			setAreas(id, ["shared"]);
			yield* prepareWork(id);
		}
		setPriority("two", "high");
		setPriority("later", "high");
		expect(yield* fleet.dispatch("one").pipe(Effect.flip)).toMatchObject({ message: "waiting for area shared queued ahead by two" });
		expect(yield* fleet.dispatch("later").pipe(Effect.flip)).toMatchObject({ message: "waiting for area shared queued ahead by two" });
		yield* schedule();
		expect((yield* get("two")).value.step).toBe("working");
		expect((yield* get("one")).value.step).toBe("queued");
		expect((yield* get("later")).value.step).toBe("queued");
		yield* finishWorker("two");
		yield* fleet.reconcile("two");
		yield* schedule();
		expect((yield* get("later")).value.step).toBe("working");
		expect(
			providerStarts()
				.filter(({ access }) => access !== "read-only")
				.map(({ prompt }) => prompt),
		).toEqual(["Implement two", "Implement later"]);
	},
);

isolatedEngine.it(
	"a waiter blocked by a foreign area holder leaves its other area available",
	[],
	function* ({ reserveForeign, setAreas, prepareWork, schedule, get }) {
		yield* reserveForeign("external", ["area-a"]);
		setAreas("one", ["area-a", "area-b"]);
		setAreas("two", ["area-b"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* schedule();
		expect((yield* get("one")).value).toMatchObject({ attempts: [], blocker: "waiting for area area-a held by external", step: "queued" });
		expect((yield* get("two")).value.step).toBe("working");
	},
);

for (const priority of ["urgent", "high"] as const) {
	isolatedEngine.it(
		`a blocked ${priority} waiter launches when its area frees ahead of lower-priority contenders`,
		[],
		function* ({ approveWork, setAreas, setPriority, prepareWork, fleet, schedule, get, finishWorker, providerStarts }) {
			for (const id of ["one", "two", "waiter"]) {
				approveWork(id, `board-${id}`);
				setAreas(id, ["shared"]);
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("one");
			setPriority("waiter", priority);
			yield* schedule();
			expect((yield* get("waiter")).value.blocker).toBe("waiting for area shared held by one");
			approveWork("later", "board-later");
			setAreas("later", ["shared"]);
			yield* prepareWork("later");
			yield* finishWorker("one");
			yield* fleet.reconcile("one");
			yield* schedule();
			expect((yield* get("waiter")).value.step).toBe("working");
			expect((yield* get("two")).value.step).toBe("queued");
			expect((yield* get("later")).value.step).toBe("queued");
			expect(
				providerStarts()
					.filter(({ access }) => access !== "read-only")
					.map(({ prompt }) => prompt),
			).toEqual(["Implement one", "Implement waiter"]);
		},
	);
}

isolatedEngine.it(
	"a waiter blocked on a dependency leaves its areas available to later work",
	[],
	function* ({ setAreas, setDependencies, prepareWork, schedule, get }) {
		setAreas("one", ["shared"]);
		setDependencies("one", ["dependency"]);
		setAreas("two", ["shared"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* schedule();
		expect((yield* get("one")).value).toMatchObject({
			attempts: [],
			blocker: expect.stringContaining("waiting for dependency dependency"),
			step: "queued",
		});
		expect((yield* get("two")).value.step).toBe("working");
	},
);
