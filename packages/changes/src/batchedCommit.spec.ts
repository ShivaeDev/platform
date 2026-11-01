import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes } from "#test/kit.ts";

changes.it(
	"bob's transaction inside nested batches reaches the committed sink only after commit and ada's batch change reaches the ordinary sink",
	[],
	function* ({ withCommittedSink, batch, inTransaction, write, committedSinkReceived, committedRows, published }) {
		yield* batch(function* () {
			yield* write("ada's order", change("ada"));
			yield* batch(
				withCommittedSink(
					inTransaction(function* () {
						yield* write("bob's order", change("bob"));
						expect(yield* committedSinkReceived()).toEqual([]);
					}),
				),
			);

			yield* outcomes([
				["committed rows", () => committedRows(), ["ada's order", "bob's order"]],
				["committed sink", () => committedSinkReceived(), [["bob:orders"]]],
				["ordinary sink", () => published(), []],
			]);
		});

		expect(yield* published()).toEqual([["ada:orders"]]);
	},
);

changes.it(
	"a transaction that rolls back inside a batch reaches neither the committed sink nor the ordinary sink",
	[],
	function* ({ withCommittedSink, batch, inTransaction, write, rollback, committedSinkReceived, published }) {
		yield* withCommittedSink(
			batch(
				inTransaction(function* () {
					yield* write("bob's order", change("bob"));
					yield* rollback();
				}),
			),
		);

		yield* outcomes([
			["committed sink", () => committedSinkReceived(), []],
			["ordinary sink", () => published(), []],
		]);
	},
);

for (const rollsBack of [false, true]) {
	changes.it(
		`a savepoint inside a batch waits for its enclosing transaction and ${rollsBack ? "publishes nothing on rollback" : "publishes once on commit"}`,
		[],
		function* ({ withCommittedSink, batch, inTransaction, write, rollback, committedSinkReceived, published }) {
			yield* withCommittedSink(
				inTransaction(function* () {
					yield* write("ada's order", change("ada"));
					yield* batch(inTransaction(write("bob's order", change("bob"))));
					expect(yield* committedSinkReceived()).toEqual([]);
					if (rollsBack) {
						yield* rollback();
					}
				}),
			);

			yield* outcomes([
				["committed sink", () => committedSinkReceived(), rollsBack ? [] : [["ada:orders", "bob:orders"]]],
				["ordinary sink", () => published(), []],
			]);
		},
	);
}
