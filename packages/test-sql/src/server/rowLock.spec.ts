import { expect } from "vitest";
import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

database.it("rollback releases a shared row lock before another test writes the same key", [poolLimit(3)], function* ({ contendForRow }) {
	expect(yield* contendForRow()).toEqual({
		attempts: [{ after: [{ value: "second" }], before: [{ value: "seed" }] }],
		rolledBack: [{ value: "seed" }],
	});
});
