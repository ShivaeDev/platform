import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pool } from "#test/pool.ts";
import { postgresOptions } from "#test/postgres.ts";

pool.it(
	"a client query waits while every pool connection is reserved and runs on the connection released first",
	[],
	function* ({ distinctReservedBackends, queriedBackend, queryWhileEveryConnectionIsReserved, releaseOneReservation, reserveEveryConnection }) {
		yield* reserveEveryConnection();
		expect(yield* distinctReservedBackends()).toBe(postgresOptions.maxConnections);
		yield* queryWhileEveryConnectionIsReserved();

		yield* releaseOneReservation();

		expect(yield* queriedBackend()).toBe("the released connection");
	},
);

pool.it(
	"a connection reserved from the pool sees an order the client writes only once the client commits",
	[],
	function* ({ commitOrderWhileReservedConnectionWatches, seenAfterCommit, seenBeforeCommit }) {
		yield* commitOrderWhileReservedConnectionWatches();

		yield* outcomes({
			"orders seen after the commit": [seenAfterCommit(), [1]],
			"orders seen before the commit": [seenBeforeCommit(), []],
		});
	},
);

pool.it(
	"a native notification sent inside a client transaction arrives before the transaction ends, because it takes its own connection",
	[],
	function* ({ deliveredInsideTheTransaction, notifyInsideRejectedTransaction, transactionEndings }) {
		yield* notifyInsideRejectedTransaction();

		yield* outcomes({
			"notifications delivered inside the transaction": [deliveredInsideTheTransaction(), ["delivered"]],
			"transaction endings": [transactionEndings(), ["failed with rejected"]],
		});
	},
);
