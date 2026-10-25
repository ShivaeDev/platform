import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { app, realPostgres } from "#test/order-example/application.ts";
import { localApplication } from "#test/order-example/localApplication.ts";
import { aliceHasOrder, orderEditorIsOpen, orderListIsOpen } from "#test/order-example/traits.ts";

expectNoReactWarnings();

app.it(
	"a save commits, a rejected write rolls back, and Bob cannot read Alice's order",
	[realPostgres(), aliceHasOrder("paper")],
	function* ({ databaseSetup, saveOrder, rejectOrder, readAsBob, storedOrder, changes }) {
		expect(databaseSetup()).toEqual({ activeScreens: 0, migrations: [{ "migration_id": 1 }], orders: [] });
		yield* saveOrder("paper", "Office chairs", 8);
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 8 }]);
		expect(changes()).toEqual(["orders"]);
		expect(yield* rejectOrder("paper", -1)).toMatchObject({ _tag: "Failure", failure: { _tag: "OrderValidation", field: "quantity" } });
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 8 }]);
		expect(changes()).toEqual(["orders"]);
		expect(yield* readAsBob("paper")).toMatchObject({ _tag: "Failure", failure: { _tag: "OrderNotFound" } });
	},
);

app.it(
	"a React action refreshes the list after its HTTP save commits",
	[realPostgres(), aliceHasOrder("paper"), orderListIsOpen("paper")],
	function* ({ databaseSetup, list, observe, renameFromList, storedOrder }) {
		expect(databaseSetup()).toEqual({ activeScreens: 0, migrations: [{ "migration_id": 1 }], orders: [] });
		yield* observe("the list renders the saved order", () => expect(list()).toEqual(["Printer paper / 3"]));
		yield* renameFromList();
		yield* observe("the list renders the saved order", () => expect(list()).toEqual(["Office chairs / 8"]));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 8 }]);
	},
);

app.it(
	"a rejected form preserves its draft and storage, then saves corrected decoded input",
	[realPostgres(), aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ databaseSetup, editor, observe, editQuantity, submitOrder, storedOrder }) {
		expect(databaseSetup()).toEqual({ activeScreens: 0, migrations: [{ "migration_id": 1 }], orders: [] });
		yield* observe("the order is ready", () => expect(editor().quantity).toBe("3"));
		yield* editQuantity("-1");
		yield* submitOrder();
		yield* observe("read the form error", () => expect(editor().alert).toBe("Quantity must be a whole number between 0 and 5000"));
		yield* observe("read the quantity draft", () => expect(editor().quantity).toBe("-1"));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 3 }]);
		yield* editQuantity("12");
		yield* submitOrder();
		yield* observe("the save and refresh finish", () => {
			expect(editor().status).toBe("Saved");
			expect(editor().refreshDisabled).toBe(false);
		});
		expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 12 }]);
	},
);

app.it.fails(
	"a failing story still unmounts and resets",
	[realPostgres(), aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ databaseSetup, editor, observe, saveOrder }) {
		expect(databaseSetup()).toEqual({ activeScreens: 0, migrations: [{ "migration_id": 1 }], orders: [] });
		yield* observe("the order is ready", () => expect(editor().quantity).toBe("3"));
		yield* saveOrder("paper", "Before failure", 9);
		yield* Effect.fail("intentional cleanup failure");
	},
);

localApplication.it(
	"local rollback shares the worker database and prevents publication and independent reads",
	[],
	function* ({ sharesWorkerDatabase, inRollback, seedLocalOrder, saveLocally, rejectLocally, observerOrders, changes }) {
		expect(sharesWorkerDatabase()).toBe(true);
		yield* inRollback(
			Effect.gen(function* () {
				yield* seedLocalOrder();
				expect(yield* saveLocally()).toMatchObject({ name: "Local save", quantity: 12 });
				expect(yield* rejectLocally()).toMatchObject({ _tag: "Failure", failure: { _tag: "OrderValidation" } });
				expect(yield* observerOrders()).toEqual([]);
				expect(changes()).toEqual([]);
			}),
		);
		expect(yield* observerOrders()).toEqual([]);
		expect(changes()).toEqual([]);
	},
);

app.it(
	"the next story sees empty tables, restarted identities and the migration ledger",
	[realPostgres(), aliceHasOrder("paper")],
	function* ({ databaseSetup, orderId, storedOrder }) {
		expect(databaseSetup()).toEqual({ activeScreens: 0, migrations: [{ "migration_id": 1 }], orders: [] });
		const restartedIdentity = 1;
		expect(orderId("paper")).toBe(restartedIdentity);
		expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 3 }]);
	},
);
