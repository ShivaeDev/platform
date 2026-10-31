import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { transactionKits, watching } from "#test/transactions.ts";

const NOT_OWNED = "died with transact cannot announce changes after a transaction it does not own; begin the outer transaction with transact";

for (const transactions of transactionKits) {
	transactions.it(
		"a committed transaction announces each of its keys once, only after its body returns",
		[watching(transactions, "orders", "orders:1")],
		function* ({ announce, announced, endings, inTransaction, orders, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
				yield* announce(["orders"]);
				expect(yield* announced()).toEqual([]);
			});

			yield* outcomes({
				"announced keys": [announced(), ["orders", "orders:1"]],
				"stored orders": [orders(), [1]],
				"transaction endings": [endings(), ["committed"]],
			});
		},
	);

	transactions.it(
		"a rejected transaction rolls back its order and announces nothing",
		[watching(transactions, "orders", "orders:1")],
		function* ({ announce, announced, endings, inTransaction, orders, rejects, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
				yield* rejects();
			});

			yield* outcomes({
				"announced keys": [announced(), []],
				"stored orders": [orders(), []],
				"transaction endings": [endings(), ["failed with rejected"]],
			});
		},
	);

	transactions.it(
		"an interrupted transaction rolls back its order and announces nothing",
		[watching(transactions, "orders", "orders:1")],
		function* ({ announce, announced, endings, interruptTransactionAfter, orders, saveOrder }) {
			yield* interruptTransactionAfter(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
			});

			yield* outcomes({
				"announced keys": [announced(), []],
				"stored orders": [orders(), []],
				"transaction endings": [endings(), ["interrupted"]],
			});
		},
	);

	transactions.it(
		"a COMMIT that fails a deferred foreign key fails through onSqlError, keeps no order and announces nothing",
		[watching(transactions, "orders", "orders:1")],
		function* ({ announce, announced, endings, inTransaction, orders, saveOrder, writeNoteForMissingOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* writeNoteForMissingOrder();
				yield* announce({ orders: [1] });
			});

			yield* outcomes({
				"announced keys": [announced(), []],
				"stored orders": [orders(), []],
				"transaction endings": [endings(), ["failed with storage unavailable after a constraint violation"]],
			});
		},
	);

	transactions.it(
		"a duplicate order inside a transaction fails through the caller's onSqlError",
		[],
		function* ({ inTransaction, orders, saveOrder }) {
			yield* saveOrder(1);
			expect(yield* orders()).toEqual([1]);

			const ending = yield* inTransaction(function* () {
				yield* saveOrder(1);
			});

			expect(ending).toMatch(/^failed with storage unavailable after a (?<violation>unique|constraint) violation$/u);
		},
	);

	transactions.it(
		"a transaction begun inside a native sql.withTransaction dies, because transact does not own the outer transaction",
		[],
		function* ({ inNativeTransaction, inTransaction, saveOrder }) {
			const ending = yield* inNativeTransaction(function* () {
				return yield* inTransaction(function* () {
					yield* saveOrder(2);
				});
			});

			expect(ending).toBe(NOT_OWNED);
		},
	);

	transactions.it(
		"announcing inside a native sql.withTransaction dies, because transact does not own the transaction",
		[],
		function* ({ announce, inNativeTransaction }) {
			const ending = yield* inNativeTransaction(function* () {
				yield* announce(["orders"]);
			});

			expect(ending).toBe(NOT_OWNED);
		},
	);

	transactions.it(
		"announcing outside any transaction publishes the keys at once",
		[watching(transactions, "orders")],
		function* ({ announce, announced }) {
			yield* announce(["orders"]);

			expect(yield* announced()).toEqual(["orders"]);
		},
	);

	transactions.it(
		"a nested transaction's keys wait for the outermost commit and are announced once",
		[watching(transactions, "orders", "orders:1")],
		function* ({ announce, announced, inTransaction, orders, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
				yield* inTransaction(function* () {
					yield* saveOrder(2);
					yield* announce({ orders: [1] });
				});
				expect(yield* announced()).toEqual([]);
			});

			yield* outcomes({
				"announced keys": [announced(), ["orders", "orders:1"]],
				"stored orders": [orders(), [1, 2]],
			});
		},
	);

	transactions.it(
		"a rejected nested transaction discards its order and its keys while the outer transaction commits",
		[watching(transactions, "orders:1", "orders:2")],
		function* ({ announce, announced, endings, inTransaction, orders, rejects, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce({ orders: [1] });
				yield* inTransaction(function* () {
					yield* saveOrder(2);
					yield* announce({ orders: [2] });
					yield* rejects();
				});
			});

			yield* outcomes({
				"announced keys": [announced(), ["orders:1"]],
				"stored orders": [orders(), [1]],
				"transaction endings, innermost first": [endings(), ["failed with rejected", "committed"]],
			});
		},
	);

	transactions.it(
		"a fiber that announces after its transaction committed dies",
		[watching(transactions, "orders:2")],
		function* ({ saveOrderLeavingStraggler, stragglerAnnounces }) {
			yield* saveOrderLeavingStraggler(1, { orders: [2] });

			const ending = yield* stragglerAnnounces();

			expect(ending).toBe(
				"died with @shivaedev/sql/transact: changes arrived after their transaction settled; record them before the transaction body returns",
			);
		},
	);
}
