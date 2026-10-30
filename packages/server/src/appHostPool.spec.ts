import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { pool, poolCapacity } from "#test/app-host/pool.ts";

const database = environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL");

for (const mode of ["database", "host"] as const) {
	for (const limit of [2, 3]) {
		pool.it.runIf(database !== undefined)(
			`${mode} queues work at maxConnections ${limit} and resumes it when a transaction releases its connection`,
			[poolCapacity(mode, limit)],
			function* ({ holdConnection, query, releaseConnection }) {
				const held: number[] = [];
				for (let index = 0; index < limit - 1; index += 1) {
					held.push(yield* holdConnection());
				}
				expect(new Set(held).size).toBe(limit - 1);
				const queued = yield* query().pipe(Effect.forkChild);
				expect(yield* Fiber.join(queued).pipe(Effect.timeoutOption("50 millis"))).toMatchObject({ _tag: "None" });
				const released = held[0];
				if (released === undefined) {
					throw new Error("The story must hold a connection");
				}
				yield* releaseConnection(released);
				expect(yield* Fiber.join(queued)).toEqual([{ pid: released }]);
			},
		);
	}
}

pool.it.runIf(database !== undefined)(
	"recovers an idle connection and preserves active query failures",
	[poolCapacity("host", 2)],
	function* ({ query, terminate, nativeQueryFailure, nativePoolQuery }) {
		const [previous] = yield* query();
		if (previous === undefined) {
			throw new Error("The application pool returned no backend");
		}
		expect(yield* nativePoolQuery()).toEqual([{ pid: previous.pid }]);
		yield* terminate(previous.pid);
		const [recovered] = yield* query();
		expect(recovered?.pid).not.toBe(previous.pid);
		expect(yield* nativeQueryFailure()).toMatchObject({ _tag: "SqlError" });
		expect(yield* query()).toEqual([{ pid: expect.any(Number) }]);
	},
);
