import { Effect } from "effect";
import { expect } from "vitest";
import { humanMergeCanArriveLate } from "#test/engineAreaTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const [held, waiting] of [
	["work-fleet", "work-fleet/host"],
	["work-fleet/host", "work-fleet"],
] as const) {
	isolatedEngine.it(
		`${waiting} waits for ${held} through review and launches after its merge`,
		[humanMergeCanArriveLate()],
		function* ({ fleet, setAreas, prepareWork, finishWorkers, mergePullRequest, launches }) {
			setAreas("one", [held]);
			setAreas("two", [waiting]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
			expect(launches()).toEqual(["operation-1"]);
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.step).toBe("queued");
			mergePullRequest();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect((yield* fleet.dispatch("two")).value.step).toBe("working");
		},
	);
}

for (const other of ["work-fleet/cli", "work-fleets"]) {
	isolatedEngine.it(`work-fleet/host and ${other} run side by side`, [], function* ({ fleet, setAreas, prepareWork, launches }) {
		setAreas("one", ["work-fleet/host"]);
		setAreas("two", [other]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		const records = yield* Effect.all([fleet.dispatch("one"), fleet.dispatch("two")], { concurrency: "unbounded" });
		expect(records.map(({ value }) => value.step)).toEqual(["working", "working"]);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	});
}

isolatedEngine.it(
	"a wildcard waits for all holders, then blocks every area and keeps its queue position across restart",
	[],
	function* ({ fleet, setAreas, setDependencies, prepareWork, finishWorkers, restart, approveWork, providerStarts }) {
		for (const [id, area] of [
			["one", "work-fleet/host"],
			["two", "work-board/ui"],
			["dependent", "*"],
			["later", "other"],
		] as const) {
			setAreas(id, [area]);
			setDependencies(id, []);
			approveWork(id, `board-${id}`);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("one");
		yield* fleet.dispatch("two");
		yield* fleet.dispatch("dependent").pipe(Effect.result);
		expect((yield* fleet.get("dependent")).value.blocker).toContain("held by one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("dependent").pipe(Effect.result);
		expect((yield* fleet.get("dependent")).value.blocker).toContain("held by two");
		yield* fleet.reconcile("two");
		yield* restart();
		yield* fleet.dispatch("later").pipe(Effect.result);
		expect((yield* fleet.get("later")).value.blocker).toContain("queued ahead by dependent");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		yield* fleet.dispatch("later").pipe(Effect.result);
		expect((yield* fleet.get("later")).value.blocker).toContain("held by dependent");
		expect(
			providerStarts()
				.filter((start) => start.access !== "read-only")
				.map(({ prompt }) => prompt),
		).toEqual(["Implement one", "Implement two", "Implement dependent"]);
	},
);
