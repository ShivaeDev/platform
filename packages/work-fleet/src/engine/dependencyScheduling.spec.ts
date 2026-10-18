import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"a dependency chain launches in order after validated completion",
	[noChangeReported()],
	function* ({ fleet, prepareWork, setDependencies, schedule, restart, finishWorkers, providerStarts }) {
		setDependencies("two", ["one"]);
		setDependencies("dependent", ["two"]);
		for (const id of ["dependent", "two", "one"]) {
			yield* prepareWork(id);
		}
		yield* schedule();
		expect((yield* fleet.get("two")).value.blocker).toContain("waiting for dependency one");
		expect((yield* fleet.get("two")).value.attentionOwner).toBe("automation");
		expect((yield* fleet.get("dependent")).value.blocker).toContain("waiting for dependency two");
		for (const id of ["one", "two"]) {
			finishWorkers();
			expect((yield* fleet.reconcile(id)).value.stage).toBe("completed");
			yield* restart();
			yield* schedule();
		}
		expect(
			providerStarts()
				.filter((start) => start.access !== "read-only")
				.map((start) => start.prompt),
		).toEqual(["Implement one", "Implement two", "Implement dependent"]);
	},
);

engine.it(
	"done Board dependencies qualify with no record or after their prepared Fleet work releases",
	[],
	function* ({ fleet, prepareWork, setDependencies, setBoardStatus }) {
		setDependencies("dependent", ["external"]);
		yield* prepareWork("dependent");
		expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.get("dependent")).value.blocker).toContain("not done on the Board");
		setBoardStatus("external", "done");
		expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
		setDependencies("two", ["one"]);
		setBoardStatus("one", "done");
		yield* prepareWork("one");
		yield* prepareWork("two");
		expect(yield* fleet.dispatch("two").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.get("two")).value.blocker).toContain("Fleet work is still active (prepared)");
		expect((yield* fleet.dispatch("one")).value.stage).toBe("released");
		expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	},
);

engine.it(
	"a dependency that shares an area with an earlier dependent can still launch",
	[],
	function* ({ fleet, prepareWork, setAreas, finishWorkers }) {
		setAreas("dependent", ["fleet/host"]);
		setAreas("one", ["fleet/host"]);
		yield* prepareWork("dependent");
		yield* prepareWork("one");
		expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
		finishWorkers();
		yield* fleet.reconcile("one");
		expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
	},
);
