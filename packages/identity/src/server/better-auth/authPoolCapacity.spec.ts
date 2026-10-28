import { expect } from "vitest";
import { authPool, lockHeld, openAuthPool } from "#test/better-auth/pool.ts";

authPool.it(
	"four auth queries that start at once wait on no more than the pool's two backends, each under the pool's application name",
	[openAuthPool({ maxBackends: 2 }), lockHeld],
	function* ({ backends, startQueries }) {
		yield* startQueries(4);

		expect(yield* backends()).toEqual(["waiting on the lock", "waiting on the lock"]);
	},
);
