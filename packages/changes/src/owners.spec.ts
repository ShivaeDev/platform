import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes, hasOwner } from "#test/kit.ts";

changes.it(
	"billing's transaction inside main's publishes at billing's commit and survives main's rollback",
	[hasOwner("billing")],
	function* ({ database, rollback, published }) {
		const main = database("main");
		const billing = database("billing");

		yield* main.inTransaction(function* () {
			yield* main.write("ada's order", change("ada"));
			yield* billing.inTransaction(billing.write("bob's invoice", change("bob", "invoices")));
			expect(yield* published()).toEqual([["bob:invoices"]]);
			yield* rollback();
		});

		yield* outcomes({
			"billing's rows": [billing.committedRows(), ["bob's invoice"]],
			"main's rows": [main.committedRows(), []],
			"published changes": [published(), [["bob:invoices"]]],
		});
	},
);

changes.it(
	"billing's transaction reopened inside main's, inside billing's own, joins billing's outer transaction and rolls back with it, while main's commits and publishes",
	[hasOwner("billing")],
	function* ({ database, rollback, published }) {
		const main = database("main");
		const billing = database("billing");

		yield* billing.inTransaction(function* () {
			yield* main.inTransaction(function* () {
				yield* main.write("ada's order", change("ada"));
				yield* billing.inTransaction(billing.write("bob's invoice", change("bob", "invoices")));
			});
			expect(yield* published()).toEqual([["ada:orders"]]);
			yield* rollback();
		});

		yield* outcomes({
			"billing's rows": [billing.committedRows(), []],
			"main's rows": [main.committedRows(), ["ada's order"]],
			"published changes": [published(), [["ada:orders"]]],
		});
	},
);

changes.it(
	"bob's invoice written inside main's transaction belongs to billing's enclosing transaction and rolls back with it, while main's commits and publishes",
	[hasOwner("billing")],
	function* ({ database, rollback, published }) {
		const main = database("main");
		const billing = database("billing");

		yield* billing.inTransaction(function* () {
			yield* main.inTransaction(function* () {
				yield* main.write("ada's order", change("ada"));
				yield* billing.write("bob's invoice", change("bob", "invoices"));
			});
			expect(yield* published()).toEqual([["ada:orders"]]);
			yield* rollback();
		});

		yield* outcomes({
			"billing's rows": [billing.committedRows(), []],
			"main's rows": [main.committedRows(), ["ada's order"]],
			"published changes": [published(), [["ada:orders"]]],
		});
	},
);
