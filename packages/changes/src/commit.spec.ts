import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes, commitWaits, transactionEnds } from "#test/kit.ts";

changes.it(
	"ada's order transaction publishes nothing while its body runs and publishes ada's change once it commits",
	[],
	function* ({ inTransaction, write, published, committedRows }) {
		yield* inTransaction(function* () {
			yield* write("ada's order", change("ada"));
			expect(yield* published()).toEqual([]);
		});

		yield* outcomes({
			"committed rows": [committedRows(), ["ada's order"]],
			"published changes": [published(), [["ada:orders"]]],
		});
	},
);

changes.it(
	"a committed transaction publishes each subject and domain once, together, in the order first recorded",
	[],
	function* ({ inTransaction, write, record, published }) {
		yield* inTransaction(function* () {
			yield* write("ada's order", change("ada"), change("bob"));
			yield* record(change("ada"), change("ada", "invoices"), change("bob"));
		});

		expect(yield* published()).toEqual([["ada:orders", "bob:orders", "ada:invoices"]]);
	},
);

for (const ending of ["rejected", "died", "interrupted", "commit failed"] as const) {
	changes.it(
		`when ada's order transaction ends as ${ending}, nothing is committed and nothing is published`,
		[transactionEnds(ending)],
		function* ({ saveOrder, orderEnding, committedRows, published }) {
			yield* saveOrder("ada");

			yield* outcomes({
				"committed rows": [committedRows(), []],
				"how the transaction ended": [orderEnding(), ending],
				"published changes": [published(), []],
			});
		},
	);
}

changes.it(
	"bob's savepoint inside ada's transaction publishes nothing when it commits and publishes with ada's change at the transaction's commit",
	[],
	function* ({ inTransaction, write, published }) {
		yield* inTransaction(function* () {
			yield* write("ada's order", change("ada"));
			yield* inTransaction(write("bob's order", change("bob")));
			expect(yield* published()).toEqual([]);
		});

		expect(yield* published()).toEqual([["ada:orders", "bob:orders"]]);
	},
);

changes.it(
	"cyd's savepoint that rolls back inside ada's transaction is discarded while ada's order commits and publishes",
	[],
	function* ({ inTransaction, write, rollback, committedRows, published }) {
		yield* inTransaction(function* () {
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
	"forty concurrent records of ten subjects inside one transaction publish each subject once, together",
	[],
	function* ({ inTransaction, record, publishedInAnyOrder }) {
		const subjects = Array.from({ length: 40 }, (_, index) => `subject ${index % 10}`);

		yield* inTransaction(
			Effect.forEach(subjects, (subject) => Effect.andThen(Effect.yieldNow, record(change(subject))), { concurrency: "unbounded" }),
		);

		expect(yield* publishedInAnyOrder()).toEqual([Array.from({ length: 10 }, (_, index) => `subject ${index}:orders`)]);
	},
);

changes.it("a write outside any transaction publishes its changes at once, each only once", [], function* ({ write, published }) {
	yield* write("ada's order", change("ada"), change("bob"), change("ada"));

	expect(yield* published()).toEqual([["ada:orders", "bob:orders"]]);
});

changes.it(
	"an interruption that arrives while ada's commit is in flight ends her save as interrupted and still publishes the committed order",
	[commitWaits()],
	function* ({ startSavingOrder, interruptOrder, orderEnding, committedRows, published }) {
		yield* startSavingOrder("ada");
		expect(yield* published()).toEqual([]);

		yield* interruptOrder();

		yield* outcomes({
			"committed rows": [committedRows(), ["ada's order"]],
			"how the transaction ended": [orderEnding(), "interrupted"],
			"published changes": [published(), [["ada:orders"]]],
		});
	},
);
