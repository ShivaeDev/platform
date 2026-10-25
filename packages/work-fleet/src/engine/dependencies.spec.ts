import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"current dependency revision requires fresh accepted completion while unrelated work dispatches",
	[noChangeReported()],
	function* ({ approveWork, editWork, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		editWork("one", "board-one-changed");
		approveWork("one", "board-one-changed");
		yield* prepareWork("dependent");
		yield* prepareWork("two");
		expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.get("dependent")).value.blocker).toContain("board-one-changed");
		expect((yield* fleet.dispatch("two")).value.step).toBe("working");
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		expect((yield* fleet.get("dependent")).value.blocker).toBeUndefined();
	},
);

engine.it(
	"unavailable or ambiguous current Board dependency never reuses a historical accepted outcome",
	[noChangeReported()],
	function* ({ unavailableWork, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* prepareWork("dependent");
		unavailableWork("one", true);
		yield* fleet.dispatch("dependent").pipe(Effect.flip);
		expect((yield* fleet.get("dependent")).value.blocker).toContain("unavailable or ambiguous");
		unavailableWork("one", false);
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
	},
);

engine.it(
	"criterion-specific dependencies do not inherit whole-work acceptance",
	[noChangeReported()],
	function* ({ setDependencies, launches, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		setDependencies("dependent", ["one#criterion"]);
		yield* prepareWork("dependent");
		yield* fleet.dispatch("dependent").pipe(Effect.flip);
		expect((yield* fleet.get("dependent")).value.blocker).toContain("criterion-specific accepted evidence");
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);
