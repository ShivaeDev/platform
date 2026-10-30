import { expect } from "vitest";
import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

for (const lock of ["row", "table", "advisory"] as const) {
	database.it(
		`${lock === "advisory" ? "an" : "a"} ${lock} lock queues every competing write before release`,
		[poolLimit(4)],
		function* ({ raceWrites, queuedWrites }) {
			yield* raceWrites(true, lock);

			const queued = yield* queuedWrites();
			const statement = expect.stringContaining(lock === "advisory" ? "pg_advisory_xact_lock(42)" : "update items");
			expect(queued).toEqual([statement, statement, statement]);
		},
	);
}

database.it("a guarded write admits exactly one contender and returns the other typed failures", [poolLimit(4)], function* ({ raceWrites }) {
	const results = yield* raceWrites(true);

	expect(results.filter((value) => value === "full")).toEqual(["full", "full"]);
	expect(results.filter((value) => value !== "full")).toEqual([expect.stringMatching(/^(?:alice|bob|charlie)$/v)]);
});

database.it("an unguarded write admits every contender and returns results in input order", [poolLimit(4)], function* ({ raceWrites }) {
	const results = yield* raceWrites(false);

	expect(results).toEqual(["alice", "bob", "charlie"]);
});
