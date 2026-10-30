import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commitsSlowly, ordersHaveBigintIds, postgresTransactions, subscriberThrows, transactionKits, watching } from "#test/transactions.ts";

const ID_BEYOND_NUMBER = 9_007_199_254_740_993n;

postgresTransactions.it(
	"interrupting a transaction while its COMMIT is in flight announces exactly the order the other client then sees committed",
	[commitsSlowly(), watching(postgresTransactions, "orders", "orders:1")],
	function* ({ announce, announced, endings, interruptCommit, saveOrder, startSlowCommit, visibleOrders }) {
		yield* startSlowCommit(function* () {
			yield* saveOrder(1);
			yield* announce({ orders: [1] });
		});
		expect(yield* visibleOrders()).toEqual([]);

		yield* interruptCommit();

		yield* outcomes({
			"announced keys": [announced(), ["orders", "orders:1"]],
			"orders the other client sees": [visibleOrders(), [1]],
			"transaction endings": [endings(), ["interrupted"]],
		});
	},
);

postgresTransactions.it(
	"a committed transaction refreshes a live query of the orders on the other client",
	[],
	function* ({ announce, inTransaction, nextQueryResult, queryOrdersFromOtherPool, saveOrder }) {
		yield* queryOrdersFromOtherPool();
		expect(yield* nextQueryResult()).toEqual([]);

		yield* inTransaction(function* () {
			yield* saveOrder(1);
			yield* announce({ orders: [1] });
			yield* saveOrder(2);
			yield* announce({ orders: [2] });
		});

		expect(yield* nextQueryResult()).toEqual([1, 2]);
	},
);

postgresTransactions.it(
	"a bigint order id beyond Number precision announces its exact decimal key after commit",
	[ordersHaveBigintIds(), watching(postgresTransactions, `orders:${ID_BEYOND_NUMBER}`)],
	function* ({ announce, announced, inTransaction, orders, saveOrder }) {
		yield* inTransaction(function* () {
			yield* saveOrder(ID_BEYOND_NUMBER);
			yield* announce({ orders: [ID_BEYOND_NUMBER] });
			expect(yield* announced()).toEqual([]);
		});

		yield* outcomes({
			"announced keys": [announced(), [`orders:${ID_BEYOND_NUMBER}`]],
			"stored orders": [orders(), [ID_BEYOND_NUMBER]],
		});
	},
);

for (const transactions of transactionKits) {
	transactions.it(
		"a subscriber that throws after COMMIT is logged and the transaction still commits",
		[subscriberThrows(transactions, "orders")],
		function* ({ announce, endings, inTransaction, loggedErrors, orders, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
			});

			yield* outcomes({
				"logged errors": [loggedErrors(), [expect.stringContaining("subscriber threw (2 changes on @shivaedev/sql/transact)")]],
				"stored orders": [orders(), [1]],
				"transaction endings": [endings(), ["committed"]],
			});
		},
	);

	transactions.it(
		"a subscriber that throws on an announcement outside any transaction is logged instead of failing the caller",
		[subscriberThrows(transactions, "orders")],
		function* ({ announce, loggedErrors }) {
			yield* announce(["orders"]);

			expect(yield* loggedErrors()).toEqual([expect.stringContaining("subscriber threw (1 changes on @shivaedev/sql/transact)")]);
		},
	);
}
