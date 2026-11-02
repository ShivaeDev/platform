import { expect } from "vitest";
import { scheduledHints } from "#test/scheduledHints.ts";

scheduledHints.it(
	"live hints queue one batch on the runtime scheduler and deliver both changed notes when dispatched",
	[],
	function* ({ change, dispatch, nextHint, scheduledBatches }) {
		yield* change(1);
		yield* change(2);

		expect(yield* scheduledBatches()).toBe("scheduled once");

		yield* dispatch();

		expect(yield* nextHint()).toBe("changed notes 1, notes 2");
	},
);
