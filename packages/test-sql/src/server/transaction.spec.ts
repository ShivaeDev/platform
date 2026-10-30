import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { itemsInvalidated, itemWritten, rollbackTestOpen, watchingInvalidations } from "#test/databaseTraits.ts";

database.it(
	"a note one rollback test writes stays invisible to another rollback test running at the same time",
	[rollbackTestOpen("the first test"), rollbackTestOpen("the second test")],
	function* ({ notes, writeNote }) {
		yield* writeNote("first", "the first test");

		yield* outcomes({
			"notes in the first test": [notes("the first test"), ["first"]],
			"notes in the second test": [notes("the second test"), []],
		});
	},
);

for (const [ending, outcome] of [
	["succeeds", "succeeded"],
	["fails with rejected", "failed with rejected"],
	["dies with assertion failed", "died with assertion failed"],
] as const) {
	database.it(
		`a rollback test that ${ending} ends ${outcome} and rolls back its write`,
		[rollbackTestOpen(), itemWritten("temporary", "the rollback test")],
		function* ({ blockOutcome, end, items }) {
			expect(yield* items("the rollback test")).toEqual(["temporary"]);

			yield* end("the rollback test", ending);

			yield* outcomes({
				"items in the shared database": [items("the shared database"), ["seed"]],
				"the rollback test": [blockOutcome("the rollback test"), outcome],
			});
		},
	);
}

database.it(
	"an interrupted rollback test ends interrupted and rolls back its write",
	[rollbackTestOpen(), itemWritten("temporary", "the rollback test")],
	function* ({ blockOutcome, interrupt, items }) {
		expect(yield* items("the rollback test")).toEqual(["temporary"]);

		yield* interrupt("the rollback test");

		yield* outcomes({
			"items in the shared database": [items("the shared database"), ["seed"]],
			"the rollback test": [blockOutcome("the rollback test"), "interrupted"],
		});
	},
);

database.it(
	"a nested transaction that fails rolls back to its savepoint and keeps the rollback test's earlier write",
	[rollbackTestOpen(), itemWritten("outer", "the rollback test")],
	function* ({ items, nestedTransactionFails }) {
		expect(yield* items("the rollback test")).toEqual(["outer"]);

		yield* nestedTransactionFails("nested", "the rollback test");

		expect(yield* items("the rollback test")).toEqual(["outer"]);
	},
);

database.it(
	"an items invalidation inside a rollback test is never published when the test rolls back",
	[watchingInvalidations, rollbackTestOpen(), itemsInvalidated("the rollback test")],
	function* ({ end, publishedInvalidations }) {
		yield* end("the rollback test", "succeeds");

		expect(yield* publishedInvalidations()).toEqual([]);
	},
);
