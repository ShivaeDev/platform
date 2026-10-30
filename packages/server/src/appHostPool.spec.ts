import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pool, poolCapacity } from "#test/app-host/pool.ts";

for (const mode of ["database", "host"] as const) {
	for (const limit of [2, 3]) {
		pool.it(
			`at maxConnections ${limit}, the ${mode} pool queues a query until a held transaction releases its connection, which then answers it`,
			[poolCapacity(mode, limit)],
			function* ({ heldConnectionsFillThePool, queryWaitsForRelease }) {
				const heldBackends = yield* heldConnectionsFillThePool();

				const queuedQuery = yield* queryWaitsForRelease();

				yield* outcomes({
					"held backends": [Effect.succeed(heldBackends), limit - 1],
					"queued query": [Effect.succeed(queuedQuery), "answered by the released backend"],
				});
			},
		);
	}
}

pool.it(
	"the host's native pool service lends the same connection the application queries through",
	[poolCapacity("host", 2)],
	function* ({ nativePoolBackend, queryBackend }) {
		const backend = yield* queryBackend();

		expect(yield* nativePoolBackend()).toBe(backend);
	},
);

pool.it(
	"after an administrator terminates the idle connection, the next query runs on a new backend",
	[poolCapacity("host", 2)],
	function* ({ queryBackend, theIdleBackendIsTerminated }) {
		const terminated = yield* queryBackend();

		yield* theIdleBackendIsTerminated(terminated);

		expect(yield* queryBackend()).not.toBe(terminated);
	},
);

pool.it("a query that terminates its own backend fails with a SQL error", [poolCapacity("host", 2)], function* ({ selfTerminatingQuery }) {
	expect(yield* selfTerminatingQuery()).toBe("failed with sql error");
});

pool.it(
	"after a query terminates its own backend, the pool answers the next query",
	[poolCapacity("host", 2)],
	function* ({ queryBackend, selfTerminatingQuery }) {
		yield* selfTerminatingQuery();

		expect(yield* queryBackend()).toEqual(expect.any(Number));
	},
);
