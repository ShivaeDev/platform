import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";
import { refusal } from "#test/refusal.ts";

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
		const dependentDispatchedOutcome = yield* refusal(fleet.dispatch("dependent"));
		expect(dependentDispatchedOutcome).toMatch(/^forbidden: /u);
		expect((yield* fleet.get("dependent")).value.blocker).toContain("board-one-changed");
		const twoDispatched = yield* fleet.dispatch("two");
		expect(twoDispatched.value.step).toBe("working");
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const reconciled = yield* fleet.reconcile("one");
		expect(reconciled.value.step).toBe("done");
		const dependentDispatched = yield* fleet.dispatch("dependent");
		expect(dependentDispatched.value.step).toBe("working");
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
