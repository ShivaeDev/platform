import { app, realPostgres } from "#test/order-example/application.ts";
import { aliceHasOrder, editorIsOpen, editorsAreOpen, hasOrder, orderEditorIsOpen, saveIsHeld } from "#test/order-example/traits.ts";
import { expectNoReactWarnings } from "#testing.ts";

expectNoReactWarnings();

app.it(
	"real HTTP saves refetch the view, field rejection preserves storage, and refresh merges untouched fields beside dirty edits",
	[realPostgres(), aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({
		nameDraftIs,
		editName,
		editQuantity,
		submitOrder,
		serverOrderIs,
		formIsSaved,
		storedOrderIs,
		formShowsError,
		saveOrder,
		refreshOrder,
		quantityDraftIs,
		formIsDirty,
		revertOrder,
	}) {
		yield* nameDraftIs("Printer paper");
		yield* editName("  Office chairs  ");
		yield* editQuantity("450");
		yield* submitOrder();
		yield* serverOrderIs("Office chairs / 450");
		yield* formIsSaved();
		yield* nameDraftIs("Office chairs");
		yield* storedOrderIs("paper", "Office chairs", 450);
		yield* editQuantity("-1");
		yield* submitOrder();
		yield* formShowsError("Quantity must be a whole number between 0 and 5000");
		yield* storedOrderIs("paper", "Office chairs", 450);
		yield* editQuantity("450");
		yield* editName("Unsubmitted local edit");
		yield* saveOrder("paper", "Remote update", 900);
		yield* refreshOrder();
		yield* serverOrderIs("Remote update / 900");
		yield* nameDraftIs("Unsubmitted local edit");
		yield* quantityDraftIs("900");
		yield* formIsDirty();
		yield* revertOrder();
		yield* nameDraftIs("Remote update");
	},
);

app.it(
	"edits made while a save is in flight survive its response and query refresh",
	[realPostgres(), aliceHasOrder("paper"), saveIsHeld(), orderEditorIsOpen("paper")],
	function* ({ nameDraftIs, editName, submitOrder, saveHasEntered, releaseSave, serverOrderIs, formIsDirty, storedOrderIs }) {
		yield* nameDraftIs("Printer paper");
		yield* editName("Submitted order");
		yield* submitOrder();
		yield* saveHasEntered();
		yield* editName("Newer local edit");
		yield* releaseSave();
		yield* serverOrderIs("Submitted order / 3");
		yield* nameDraftIs("Newer local edit");
		yield* formIsDirty();
		yield* storedOrderIs("paper", "Submitted order", 3);
	},
);

app.it(
	"HTTP sessions isolate owners and a revoked session cannot save",
	[
		realPostgres(),
		aliceHasOrder("paper"),
		hasOrder("lamps", { name: "Desk lamps", ownerId: "bob", quantity: 200 }),
		orderEditorIsOpen("paper"),
		editorIsOpen("bob", "lamps", "bob-session"),
		editorIsOpen("stranger", "paper", "bob-session"),
		editorIsOpen("anonymous", "paper", undefined),
		editorIsOpen("expired", "paper", "expired-session"),
	],
	function* ({ nameDraftIs, quantityDraftIs, orderIsHidden, forbiddenSave, storedOrderIs, editName, revokeAlice, submitOrder, formShowsError }) {
		yield* nameDraftIs("Printer paper");
		yield* quantityDraftIs("3");
		yield* nameDraftIs("Desk lamps", "bob");
		yield* quantityDraftIs("200", "bob");
		yield* orderIsHidden("stranger");
		yield* orderIsHidden("anonymous");
		yield* forbiddenSave("paper", "bob-session", "OrderNotFound");
		yield* forbiddenSave("paper", undefined, "Unauthorized");
		yield* forbiddenSave("paper", "expired-session", "Unauthorized");
		yield* storedOrderIs("paper", "Printer paper", 3);
		yield* editName("Must not persist");
		yield* revokeAlice();
		yield* submitOrder();
		yield* formShowsError("Could not save your order. Try again.");
		yield* storedOrderIs("paper", "Printer paper", 3);
		yield* storedOrderIs("lamps", "Desk lamps", 200);
	},
);

app.it(
	"saving one order refreshes it and the list without refetching another mounted order",
	[
		realPostgres(),
		hasOrder("paper", { quantity: 300 }),
		hasOrder("toner", { name: "Toner", quantity: 150 }),
		editorsAreOpen({ paper: "paper", toner: "toner" }, "paper"),
	],
	function* ({ listContains, nameDraftIs, getsAre, editName, submitOrder, serverOrderIs }) {
		yield* listContains(["Printer paper / 300", "Toner / 150"]);
		yield* nameDraftIs("Toner", "toner");
		yield* getsAre({ paper: 1, toner: 1 });
		yield* editName("Black toner", "toner");
		yield* submitOrder("toner");
		yield* listContains(["Printer paper / 300", "Black toner / 150"]);
		yield* serverOrderIs("Black toner / 150", "toner");
		yield* getsAre({ paper: 1, toner: 2 });
	},
);
