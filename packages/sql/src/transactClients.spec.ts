import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { transactionKits, watching } from "#test/transactions.ts";

for (const transactions of transactionKits) {
	transactions.it(
		"a transaction on the other client inside a transaction announces at its own commit and keeps its order when the outer transaction rolls back",
		[watching(transactions, "orders", "orders:1", "orders:2")],
		function* ({ announce, announced, endings, inOtherTransaction, inTransaction, orders, otherOrders, rejects, saveOrder, saveOtherOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
				yield* inOtherTransaction(function* () {
					yield* saveOtherOrder(2);
					yield* announce({ orders: [2] });
				});
				expect(yield* announced()).toEqual(["orders", "orders:2"]);
				yield* rejects();
			});

			yield* outcomes({
				"announced keys": [announced(), ["orders", "orders:2"]],
				"orders on the main client": [orders(), []],
				"orders on the other client": [otherOrders(), [2]],
				"transaction endings, innermost first": [endings(), ["committed", "failed with rejected"]],
			});
		},
	);

	transactions.it(
		"a transaction re-entered on the other client joins that client's outer transaction, not the main client's one between them",
		[watching(transactions, "orders", "orders:1", "orders:2")],
		function* ({ announce, announced, endings, inOtherTransaction, inTransaction, orders, otherOrders, rejects, saveOrder, saveOtherOrder }) {
			yield* inOtherTransaction(function* () {
				yield* saveOtherOrder(1);
				yield* inTransaction(function* () {
					yield* saveOrder(1);
					yield* announce({ orders: [1] });
					yield* inOtherTransaction(function* () {
						yield* saveOtherOrder(2);
						yield* announce(["orders:2"]);
					});
				});
				expect(yield* announced()).toEqual(["orders", "orders:1"]);
				yield* rejects();
			});

			yield* outcomes({
				"announced keys": [announced(), ["orders", "orders:1"]],
				"orders on the main client": [orders(), [1]],
				"orders on the other client": [otherOrders(), []],
				"transaction endings, innermost first": [endings(), ["committed", "committed", "failed with rejected"]],
			});
		},
	);

	transactions.it(
		"keys announced for the other client wait for its transaction, not the innermost transaction on the main client",
		[watching(transactions, "orders", "orders:1", "orders:2")],
		function* ({ announceForOther, announced, endings, inOtherTransaction, inTransaction, orders, otherOrders, rejects, saveOrder, saveOtherOrder }) {
			yield* inOtherTransaction(function* () {
				yield* inTransaction(function* () {
					yield* saveOrder(1);
					yield* saveOtherOrder(2);
					yield* announceForOther(["orders:2"]);
				});
				expect(yield* announced()).toEqual([]);
				yield* rejects();
			});

			yield* outcomes({
				"announced keys": [announced(), []],
				"orders on the main client": [orders(), [1]],
				"orders on the other client": [otherOrders(), []],
				"transaction endings, innermost first": [endings(), ["committed", "failed with rejected"]],
			});
		},
	);
}
