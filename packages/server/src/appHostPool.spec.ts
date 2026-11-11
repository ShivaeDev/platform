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

				yield* outcomes([
					["held backends", () => Effect.succeed(heldBackends), limit - 1],
					["queued query", () => Effect.succeed(queuedQuery), "answered by the released backend"],
				]);
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
