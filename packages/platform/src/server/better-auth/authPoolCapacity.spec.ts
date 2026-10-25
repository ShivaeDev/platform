import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { authPool, openAuthPool } from "#test/better-auth/pool.ts";

const APPLICATION_NAME = "auth-pool-capacity";
const CONCURRENT_QUERIES = 4;

authPool.it(
	"queues four auth queries within two named PostgreSQL backends",
	[openAuthPool({ "application_name": APPLICATION_NAME, max: 2 })],
	function* ({ blockQueries, query, outstandingQueries, backends }) {
		const release = yield* blockQueries();
		const queries = yield* Effect.all(
			Array.from({ length: CONCURRENT_QUERIES }, () => query()),
			{ concurrency: "unbounded" },
		).pipe(Effect.forkChild);
		yield* Effect.promise(() => expect.poll(outstandingQueries).toBe(CONCURRENT_QUERIES));
		yield* Effect.promise(() =>
			expect
				.poll(() => Effect.runPromise(backends(APPLICATION_NAME)))
				.toEqual([
					{ applicationName: APPLICATION_NAME, waitEvent: "advisory" },
					{ applicationName: APPLICATION_NAME, waitEvent: "advisory" },
				]),
		);
		yield* release;
		yield* Fiber.join(queries);
		expect(yield* backends(APPLICATION_NAME)).toEqual([
			{ applicationName: APPLICATION_NAME, waitEvent: "ClientRead" },
			{ applicationName: APPLICATION_NAME, waitEvent: "ClientRead" },
		]);
	},
);
