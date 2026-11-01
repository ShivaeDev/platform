import { expect } from "vitest";
import { acquisition } from "#test/acquisition.ts";

acquisition.it(
	"interrupting a rollback test on an occupied PostgreSQL pool completes promptly and ends only interrupted",
	[],
	function* ({ startTransaction, callerIsWaiting, interruptCaller }) {
		yield* startTransaction();
		expect(yield* callerIsWaiting()).toBe(true);

		const outcome = yield* interruptCaller();

		expect(outcome).toBe("interrupted");
	},
);

for (const release of ["commit", "rollback"] as const) {
	acquisition.it(
		`a race with ${release} release times out at its declared deadline while its holder waits for a PostgreSQL connection`,
		[],
		function* ({ startRace, callerIsWaiting, waitForCaller }) {
			yield* startRace(release);
			expect(yield* callerIsWaiting()).toBe(true);

			const { elapsed, outcome } = yield* waitForCaller();

			expect(outcome).toBe("timed out");
			expect(elapsed).toBeGreaterThanOrEqual(100);
			expect(elapsed).toBeLessThan(750);
		},
	);
}
