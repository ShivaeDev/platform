import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { app } from "#test/order-example/app.ts";
import { aliceHasOrder, orderEditorIsOpen, orderListIsOpen } from "#test/order-example/traits.ts";

expectNoReactWarnings();

app.it("an HTTP save commits and publishes its order change", [aliceHasOrder("paper")], function* ({ saveOrder, storedOrder, changes }) {
	yield* saveOrder("paper", "Office chairs", 8);

	expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 8 }]);
	expect(changes()).toEqual(["orders"]);
});

app.it("a rejected HTTP write rolls back and publishes no order change", [aliceHasOrder("paper")], function* ({ rejectOrder, storedOrder, changes }) {
	const rejection = yield* rejectOrder("paper", -1);

	expect(rejection).toEqual({ field: "quantity", message: "Quantity must be a whole number between 0 and 5000" });
	expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 3 }]);
	expect(changes()).toEqual([]);
});

app.it("Bob cannot read Alice's order over HTTP", [aliceHasOrder("paper")], function* ({ readAsBob }) {
	const answer = yield* readAsBob("paper");

	expect(answer).toBe("OrderNotFound");
});

app.it(
	"a React action refreshes the list after its HTTP save commits",
	[aliceHasOrder("paper"), orderListIsOpen("paper")],
	function* ({ list, observe, renameFromList, storedOrder }) {
		yield* observe("the list renders the saved order", () => expect(list()).toEqual(["Printer paper / 3"]));
		yield* renameFromList();
		yield* observe("the list renders the saved order", () => expect(list()).toEqual(["Office chairs / 8"]));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 8 }]);
	},
);

app.it(
	"a rejected form preserves its draft and storage, then saves corrected decoded input",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ editor, observe, editQuantity, submitOrder, storedOrder }) {
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
