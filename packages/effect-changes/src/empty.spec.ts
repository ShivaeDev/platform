import { expect } from "vitest";
import { changes, hasObserver } from "#test/kit.ts";

changes.it(
	"an empty change list does not call observers or subscribers inside or outside a batch",
	[hasObserver()],
	function* ({ record, batch, observing, seen, readPublished }) {
		yield* observing(record([]));
		yield* observing(batch(record([])));
		expect(seen).toEqual([]);
		expect(readPublished()).toEqual([]);
	},
);
