import { expect } from "vitest";
import { acquisition } from "#test/acquisition.ts";

acquisition.it(
	"an interrupted caller stops waiting for the native adapter's connection and ends only interrupted",
	[],
	function* ({ startCaller, callerIsWaiting, interruptCaller }) {
		yield* startCaller();
		expect(yield* callerIsWaiting()).toBe(true);

		const outcome = yield* interruptCaller();

		expect(outcome).toBe("interrupted");
	},
);
