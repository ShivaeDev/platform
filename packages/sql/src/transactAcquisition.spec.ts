import { expect } from "vitest";
import { acquisition } from "#test/acquisition.ts";

acquisition.it(
	"interrupting transact on an occupied PostgreSQL pool completes while the connection stays reserved and ends only interrupted",
	[],
	function* ({ startTransaction, transactionIsWaiting, interruptTransaction }) {
		yield* startTransaction();
		expect(yield* transactionIsWaiting()).toBe(true);

		const outcome = yield* interruptTransaction();

		expect(outcome).toBe("interrupted");
	},
);
