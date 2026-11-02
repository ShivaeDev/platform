import { Effect, Order, Schema } from "effect";
import { expect } from "vitest";
import { collection, type Key, readKeys } from "@shivaedev/changes/keys.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { subscribers, postgresTransactions as transactions } from "#test/transactions.ts";

const orders = collection("orders", Schema.Number, { owner: Schema.String, priority: Schema.Number });
const opaque = { topic: "orders" };
const watching = subscribers(transactions, {
	"Alice's orders": readKeys([orders.bucket.owner("alice")]),
	"all orders": readKeys([orders.list]),
	"Bob's orders": readKeys([orders.bucket.owner("bob")]),
	"order 1": readKeys([orders.item(1)]),
	"order 2": readKeys([orders.item(2)]),
	"other collection": readKeys([collection("invoices", Schema.Number).list]),
	"priority 1": readKeys([orders.bucket.priority(1)]),
	"priority 2": readKeys([orders.bucket.priority(2)]),
	"raw number": [42],
	"raw object": [opaque],
	"raw string": ["summary"],
});

const cases: readonly [string, readonly Key[], readonly string[]][] = [
	["list", [orders.list], ["all orders"]],
	["item", [orders.item(1)], ["all orders", "order 1"]],
	["string bucket", [orders.bucket.owner("alice")], ["Alice's orders"]],
	["numeric bucket", [orders.bucket.priority(1)], ["priority 1"]],
];

for (const [kind, keys, refreshed] of cases) {
	transactions.it(
		`a committed typed ${kind} key refreshes only matching subscribers`,
		[watching],
		function* ({ announce, announced, endings, inTransaction, orders: storedOrders, saveOrder }) {
			yield* inTransaction(function* () {
				yield* saveOrder(1);
				yield* announce(keys);
				expect(yield* announced()).toEqual([]);
			});

			yield* outcomes([
				["refreshed subscribers", () => Effect.map(announced(), (names) => names.toSorted(Order.String)), refreshed.toSorted(Order.String)],
				["stored orders", () => storedOrders(), [1]],
				["transaction endings", () => endings(), ["committed"]],
			]);
		},
	);
}

transactions.it(
	"typed and raw keys in one commit refresh matching subscribers once",
	[watching],
	function* ({ announce, announced, endings, inTransaction, saveOrder }) {
		yield* inTransaction(function* () {
			yield* saveOrder(1);
			yield* announce([orders.item(1), orders.list, orders.item(1), orders.bucket.owner("alice"), "summary", 42, opaque]);
			yield* announce({ orders: [1] });
		});

		yield* outcomes([
			[
				"refreshed subscribers",
				() => Effect.map(announced(), (names) => names.toSorted(Order.String)),
				["all orders", "order 1", "Alice's orders", "raw string", "raw number", "raw object"].toSorted(Order.String),
			],
			["transaction endings", () => endings(), ["committed"]],
		]);
	},
);

transactions.it(
	"rolled-back typed keys refresh no subscribers",
	[watching],
	function* ({ announce, announced, endings, inTransaction, orders: storedOrders, rejects, saveOrder }) {
		yield* inTransaction(function* () {
			yield* saveOrder(1);
			yield* announce([orders.list, orders.item(1), orders.bucket.owner("alice")]);
			yield* rejects();
		});

		yield* outcomes([
			["refreshed subscribers", () => announced(), []],
			["stored orders", () => storedOrders(), []],
			["transaction endings", () => endings(), ["failed with rejected"]],
		]);
	},
);

transactions.it("typed keys outside a transaction refresh matching subscribers immediately", [watching], function* ({ announce, announced }) {
	yield* announce([orders.item(1), orders.bucket.owner("alice")]);

	expect((yield* announced()).toSorted(Order.String)).toEqual(["all orders", "order 1", "Alice's orders"].toSorted(Order.String));
});
