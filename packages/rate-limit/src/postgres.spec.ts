import { expect } from "vitest";
import { limit } from "#test/makeLimiter.ts";
import { postgres } from "#test/postgres.ts";

postgres.it("admits up to the limit and refuses the next PostgreSQL call with a retry time", [], function* ({ attempt, burst }) {
	const admitted = yield* burst(limit.per, limit);
	expect(admitted).toEqual(["admitted", "admitted"]);

	const refused = yield* attempt();

	expect(refused).toMatchObject({ key: "notes:alice", refusal: "TooManyRequests", retryAt: expect.any(Number) });
});

postgres.it("two callers on independent PostgreSQL pools admit only one call together", [], function* ({ race }) {
	const results = yield* race();

	expect(results).toEqual(["TooManyRequests", "admitted"]);
});

postgres.it("unavailable PostgreSQL storage fails with StoreError preserving the SQL cause", [], function* ({ attempt, storageUnavailable }) {
	yield* storageUnavailable();

	const refused = yield* attempt();

	expect(refused).toEqual({ refusal: "RateLimitStoreError", sqlFailure: true });
});
