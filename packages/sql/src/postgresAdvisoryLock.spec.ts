import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { advisoryLocks, type HolderEnding, holderHolds } from "#test/advisoryLocks.ts";

const KEYS = [
	{ expression: "bigint", key: 9_223_372_036_854_775_807n, takes: "exactly that signed 64-bit value" },
	{ expression: "hashtextextended", key: "sql-stories:hashed-advisory-key", takes: "hashtextextended of the string with seed zero" },
] as const;

for (const { expression, key, takes } of KEYS) {
	advisoryLocks.it(`a ${typeof key} key takes the PostgreSQL advisory lock on ${takes}`, [holderHolds(key)], function* ({ rawSqlCallerTries }) {
		const tried = yield* rawSqlCallerTries(expression);

		expect(tried).toBe("already held");
	});
}

const ENDINGS: ReadonlyArray<readonly [HolderEnding, string]> = [
	["commits", "committed"],
	["rolls back", "failed with rolled back"],
	["is interrupted", "interrupted"],
];

for (const [how, ending] of ENDINGS) {
	advisoryLocks.it(
		`a contender on the same key waits until the holder's transaction ${how}, then takes the lock`,
		[holderHolds("sql-stories:shared-advisory-key")],
		function* ({ contenderEnding, contenderTakes, holderEnding, holderEnds }) {
			expect(yield* contenderTakes("sql-stories:shared-advisory-key")).toBe("waiting");

			yield* holderEnds(how);

			yield* outcomes({
				contender: [contenderEnding(), "acquired"],
				holder: [holderEnding(), ending],
			});
		},
	);
}

advisoryLocks.it(
	"a contender on a different key takes its lock at once while the holder's transaction stays open",
	[holderHolds("sql-stories:held-advisory-key")],
	function* ({ contenderTakes, holderState }) {
		const taken = yield* contenderTakes("sql-stories:held-advisory-key:other");

		yield* outcomes({
			contender: [contenderTakes("sql-stories:held-advisory-key:other"), "acquired"],
			holder: [holderState(), "still holding"],
		});
		expect(taken).toBe("acquired");
	},
);

for (const key of [1n, "job"]) {
	advisoryLocks.it(
		`an advisory lock on a ${typeof key} key outside a transaction fails with AdvisoryLockOutsideTransaction`,
		[],
		function* ({ lockOutsideTransaction }) {
			const ending = yield* lockOutsideTransaction(key);

			expect(ending).toBe("failed with advisory lock outside transaction");
		},
	);
}
