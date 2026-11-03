import { expect } from "vitest";
import { reconciliation } from "#test/reconciliation.ts";

reconciliation.it("removing a due time cancels the armed timer", [], function* ({ start, dueIn, clearDue, settled, advance, queries }) {
	yield* start("tasks");
	yield* dueIn(1000);
	yield* settled("tasks");

	yield* clearDue();
	yield* settled("tasks");
	yield* advance("1 day");

	expect(yield* queries("tasks")).toEqual([["initial"], ["initial"], ["initial"]]);
});

reconciliation.it("a new due time replaces the previous timer", [], function* ({ start, dueIn, settled, advance, queries }) {
	yield* start("tasks");
	yield* dueIn(1000);
	yield* settled("tasks");

	yield* dueIn(2000);
	yield* settled("tasks");
	yield* advance("1 second");
	expect(yield* queries("tasks")).toEqual([["initial"], ["initial"], ["initial"]]);
	yield* advance("1 second");
	yield* settled("tasks");

	expect(yield* queries("tasks")).toEqual([["initial"], ["initial"], ["initial"], ["initial"]]);
});
