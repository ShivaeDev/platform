import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { batchEnds, changes } from "#test/kit.ts";

for (const ending of ["succeeds", "fails", "is interrupted"] as const) {
	changes.it(
		`a batch that ${ending} publishes ada's and bob's changes once, after it ends, and keeps both orders committed`,
		[batchEnds(ending)],
		function* ({ batch, write, published, committedRows }) {
			yield* batch(function* () {
				yield* write("ada's order", change("ada"));
				yield* write("bob's order", change("bob"), change("ada"));
				expect(yield* published()).toEqual([]);
			});

			yield* outcomes({
				"committed rows": [committedRows(), ["ada's order", "bob's order"]],
				"published changes": [published(), [["ada:orders", "bob:orders"]]],
			});
		},
	);
}

changes.it(
	"bob's transaction inside a batch publishes nothing at its own commit and publishes with the batch when it ends",
	[],
	function* ({ batch, inTransaction, write, published }) {
		yield* batch(function* () {
			yield* write("ada's order", change("ada"));
			yield* inTransaction(write("bob's order", change("bob")));
			expect(yield* published()).toEqual([]);
		});

		expect(yield* published()).toEqual([["ada:orders", "bob:orders"]]);
	},
);

changes.it(
	"cyd's transaction that rolls back inside a batch is discarded while the batch publishes ada's change",
	[],
	function* ({ batch, inTransaction, write, rollback, committedRows, published }) {
		yield* batch(function* () {
			yield* write("ada's order", change("ada"));
			yield* inTransaction(function* () {
				yield* write("cyd's order", change("cyd"));
				yield* rollback();
			});
		});

		yield* outcomes({
			"committed rows": [committedRows(), ["ada's order"]],
			"published changes": [published(), [["ada:orders"]]],
		});
	},
);

changes.it(
	"ada's batch inside a transaction that rolls back is discarded with the transaction",
	[],
	function* ({ batch, inTransaction, write, rollback, committedRows, published }) {
		yield* inTransaction(function* () {
			yield* batch(write("ada's order", change("ada")));
			yield* rollback();
		});

		yield* outcomes({
			"committed rows": [committedRows(), []],
			"published changes": [published(), []],
		});
	},
);

changes.it(
	"bob's batch that fails inside a transaction publishes nothing when it ends and publishes at the transaction's commit",
	[batchEnds("fails")],
	function* ({ batch, inTransaction, write, published }) {
		yield* inTransaction(function* () {
			yield* batch(write("bob's order", change("bob")));
			expect(yield* published()).toEqual([]);
		});

		expect(yield* published()).toEqual([["bob:orders"]]);
	},
);
