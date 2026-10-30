import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app } from "#test/order-example/app.ts";
import {
	aliceHasOrder,
	editorIsOpen,
	editorsAreOpen,
	hasOrder,
	orderEditorIsOpen,
	quantityRejected,
	refreshedBesideDirtyEdit,
	saveHeldWithNewerEdit,
} from "#test/order-example/traits.ts";

expectNoReactWarnings();

const lamps = hasOrder("lamps", { name: "Desk lamps", ownerId: "bob", quantity: 200 });

app.it(
	"an editor save over HTTP stores the decoded input and shows the refetched order",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ editName, editQuantity, field, serverOrder, status, storedOrder, submitOrder }) {
		yield* editName("  Office chairs  ");
		yield* editQuantity("450");

		yield* submitOrder();

		yield* outcomes({
			name: [field("name"), "Office chairs"],
			"server order": [serverOrder(), "Office chairs / 450"],
			status: [status(), "Saved"],
			stored: [storedOrder("paper"), "Office chairs / 450"],
		});
	},
);

app.it(
	"a field rejection shows its message and leaves the stored order alone",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ alert, editQuantity, field, storedOrder, submitOrder }) {
		yield* editQuantity("-1");

		yield* submitOrder();

		yield* outcomes({
			alert: [alert(), "Quantity must be a whole number between 0 and 5000"],
			quantity: [field("quantity"), "-1"],
			stored: [storedOrder("paper"), "Printer paper / 3"],
		});
	},
);

app.it(
	"a corrected save after a rejection stores the decoded input",
	[quantityRejected()],
	function* ({ editQuantity, status, storedOrder, submitOrder }) {
		yield* editQuantity("12");

		yield* submitOrder();

		yield* outcomes({
			status: [status(), "Saved"],
			stored: [storedOrder("paper"), "Printer paper / 12"],
		});
	},
);

app.it(
	"a refresh adopts the server's untouched fields beside a dirty edit",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ editName, field, refreshOrder, saveOrder, serverOrder, status }) {
		yield* editName("Unsubmitted local edit");
		yield* saveOrder("paper", "Remote update", 900);

		yield* refreshOrder();

		yield* outcomes({
			name: [field("name"), "Unsubmitted local edit"],
			quantity: [field("quantity"), "900"],
			"server order": [serverOrder(), "Remote update / 900"],
			status: [status(), "Unsaved changes"],
		});
	},
);

app.it("revert after a merged refresh returns to the refreshed order", [refreshedBesideDirtyEdit()], function* ({ field, revertOrder }) {
	yield* revertOrder();

	expect(yield* field("name")).toBe("Remote update");
});

app.it(
	"an edit made while a save waits survives its response and refetch",
	[saveHeldWithNewerEdit()],
	function* ({ field, releaseSave, serverOrder, status, storedOrder }) {
		yield* releaseSave();

		yield* outcomes({
			name: [field("name"), "Newer local edit"],
			"server order": [serverOrder(), "Submitted order / 3"],
			status: [status(), "Unsaved changes"],
			stored: [storedOrder("paper"), "Submitted order / 3"],
		});
	},
);

app.it("an owner's session opens their own order", [lamps, editorIsOpen("bob", "lamps", "bob-session")], function* ({ field }) {
	yield* outcomes({
		name: [field("name", "bob"), "Desk lamps"],
		quantity: [field("quantity", "bob"), "200"],
	});
});

for (const [who, token] of [
	["another owner", "bob-session"],
	["an anonymous caller", undefined],
] as const) {
	app.it(`${who} cannot open Alice's order`, [aliceHasOrder("paper"), editorIsOpen("caller", "paper", token)], function* ({ alert, serverOrder }) {
		yield* outcomes({
			alert: [alert("caller"), "Could not load your order. Try again."],
			"server order": [serverOrder("caller"), "none"],
		});
	});
}

for (const [who, token, refusal] of [
	["another owner", "bob-session", "rejected as OrderNotFound"],
	["an anonymous caller", undefined, "rejected as Unauthorized"],
	["an expired session", "expired-session", "rejected as Unauthorized"],
] as const) {
	app.it(`${who} cannot save Alice's order`, [aliceHasOrder("paper")], function* ({ answers, forbiddenSave, storedOrder }) {
		yield* forbiddenSave("paper", token);

		yield* outcomes({
			answers: [answers(), [refusal]],
			stored: [storedOrder("paper"), "Printer paper / 3"],
		});
	});
}

app.it(
	"a revoked session's editor save fails and stores nothing",
	[aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ alert, editName, revokeAlice, storedOrder, submitOrder }) {
		yield* editName("Must not persist");
		yield* revokeAlice();

		yield* submitOrder();

		yield* outcomes({
			alert: [alert(), "Could not save your order. Try again."],
			stored: [storedOrder("paper"), "Printer paper / 3"],
		});
	},
);

app.it(
	"saving one order refreshes it and the list without refetching another mounted order",
	[
		hasOrder("paper", { quantity: 300 }),
		hasOrder("toner", { name: "Toner", quantity: 150 }),
		editorsAreOpen({ paper: "paper", toner: "toner" }, "paper"),
	],
	function* ({ editName, list, readsPerOrder, serverOrder, submitOrder }) {
		yield* editName("Black toner", "toner");

		yield* submitOrder("toner");

		yield* outcomes({
			list: [list(), ["Printer paper / 300", "Black toner / 150"]],
			reads: [readsPerOrder(), { paper: 1, toner: 2 }],
			"toner server order": [serverOrder("toner"), "Black toner / 150"],
		});
	},
);
