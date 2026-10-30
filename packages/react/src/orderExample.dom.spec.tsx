import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { app } from "#test/order-example/app.ts";
import { aliceHasOrder, editorIsOpen, editorsAreOpen, hasOrder, orderEditorIsOpen, saveIsHeld } from "#test/order-example/traits.ts";

expectNoReactWarnings();

app.it(
	"real HTTP saves refetch the view, field rejection preserves storage, and refresh merges untouched fields beside dirty edits",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ editor, observe, editName, editQuantity, submitOrder, storedOrder, saveOrder, refreshOrder, revertOrder }) {
		yield* observe("read the name draft", () => expect(editor().name).toBe("Printer paper"));
		yield* editName("  Office chairs  ");
		yield* editQuantity("450");
		yield* submitOrder();
		yield* observe("read the rendered server order", () => expect(editor().serverOrder).toBe("Office chairs / 450"));
		yield* observe("the save and refresh finish", () => {
			expect(editor().status).toBe("Saved");
			expect(editor().refreshDisabled).toBe(false);
		});
		yield* observe("read the name draft", () => expect(editor().name).toBe("Office chairs"));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 450 }]);
		yield* editQuantity("-1");
		yield* submitOrder();
		yield* observe("read the form error", () => expect(editor().alert).toBe("Quantity must be a whole number between 0 and 5000"));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Office chairs", quantity: 450 }]);
		yield* editQuantity("450");
		yield* editName("Unsubmitted local edit");
		yield* saveOrder("paper", "Remote update", 900);
		yield* refreshOrder();
		yield* observe("read the rendered server order", () => expect(editor().serverOrder).toBe("Remote update / 900"));
		yield* observe("read the name draft", () => expect(editor().name).toBe("Unsubmitted local edit"));
		yield* observe("read the quantity draft", () => expect(editor().quantity).toBe("900"));
		yield* observe("the draft stays dirty", () => expect(editor().status).toBe("Unsaved changes"));
		yield* revertOrder();
		yield* observe("read the name draft", () => expect(editor().name).toBe("Remote update"));
	},
);

app.it(
	"edits made while a save is in flight survive its response and query refresh",
	[aliceHasOrder("paper"), saveIsHeld(), orderEditorIsOpen("paper")],
	function* ({ editor, observe, editName, submitOrder, saveHasEntered, releaseSave, storedOrder }) {
		yield* observe("read the name draft", () => expect(editor().name).toBe("Printer paper"));
		yield* editName("Submitted order");
		yield* submitOrder();
		yield* saveHasEntered();
		yield* editName("Newer local edit");
		yield* releaseSave();
		yield* observe("read the rendered server order", () => expect(editor().serverOrder).toBe("Submitted order / 3"));
		yield* observe("read the name draft", () => expect(editor().name).toBe("Newer local edit"));
		yield* observe("the draft stays dirty", () => expect(editor().status).toBe("Unsaved changes"));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Submitted order", quantity: 3 }]);
	},
);

app.it(
	"HTTP sessions isolate owners and a revoked session cannot save",
	[
		aliceHasOrder("paper"),
		hasOrder("lamps", { name: "Desk lamps", ownerId: "bob", quantity: 200 }),
		orderEditorIsOpen("paper"),
		editorIsOpen("bob", "lamps", "bob-session"),
		editorIsOpen("stranger", "paper", "bob-session"),
		editorIsOpen("anonymous", "paper", undefined),
		editorIsOpen("expired", "paper", "expired-session"),
	],
	function* ({ editor, observe, forbiddenSave, storedOrder, editName, revokeAlice, submitOrder }) {
		yield* observe("read the name draft", () => expect(editor().name).toBe("Printer paper"));
		yield* observe("read the quantity draft", () => expect(editor().quantity).toBe("3"));
		yield* observe("read the name draft", () => expect(editor("bob").name).toBe("Desk lamps"));
		yield* observe("read the quantity draft", () => expect(editor("bob").quantity).toBe("200"));
		yield* observe("the other owner cannot see the order", () => {
			expect(editor("stranger").text).not.toContain("Printer paper");
			expect(editor("stranger").alert).toBeTruthy();
		});
		yield* observe("the other owner cannot see the order", () => {
			expect(editor("anonymous").text).not.toContain("Printer paper");
			expect(editor("anonymous").alert).toBeTruthy();
		});
		expect(yield* forbiddenSave("paper", "bob-session")).toBe("OrderNotFound");
		expect(yield* forbiddenSave("paper", undefined)).toBe("Unauthorized");
		expect(yield* forbiddenSave("paper", "expired-session")).toBe("Unauthorized");
		expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 3 }]);
		yield* editName("Must not persist");
		yield* revokeAlice();
		yield* submitOrder();
		yield* observe("read the form error", () => expect(editor().alert).toBe("Could not save your order. Try again."));
		expect(yield* storedOrder("paper")).toEqual([{ name: "Printer paper", quantity: 3 }]);
		expect(yield* storedOrder("lamps")).toEqual([{ name: "Desk lamps", quantity: 200 }]);
	},
);

app.it(
	"saving one order refreshes it and the list without refetching another mounted order",
	[
		hasOrder("paper", { quantity: 300 }),
		hasOrder("toner", { name: "Toner", quantity: 150 }),
		editorsAreOpen({ paper: "paper", toner: "toner" }, "paper"),
	],
	function* ({ list, observe, editor, gets, orderId, editName, submitOrder }) {
		yield* observe("the list renders both orders", () => expect(list()).toEqual(["Printer paper / 300", "Toner / 150"]));
		yield* observe("read the name draft", () => expect(editor("toner").name).toBe("Toner"));
		expect(gets()).toEqual(
			new Map([
				[orderId("paper"), 1],
				[orderId("toner"), 1],
			]),
		);
		yield* editName("Black toner", "toner");
		yield* submitOrder("toner");
		yield* observe("the list renders both orders", () => expect(list()).toEqual(["Printer paper / 300", "Black toner / 150"]));
		yield* observe("read the rendered server order", () => expect(editor("toner").serverOrder).toBe("Black toner / 150"));
		expect(gets()).toEqual(
			new Map([
				[orderId("paper"), 1],
				[orderId("toner"), 2],
			]),
		);
	},
);
