import { Effect } from "effect";
import { app, realPostgres } from "#test/order-example/application.ts";
import { localApp, localOrder } from "#test/order-example/localApplication.ts";
import { hasPostgres } from "#test/order-example/postgres.ts";
import { aliceHasOrder, orderEditorIsOpen, orderListIsOpen } from "#test/order-example/traits.ts";
import { expectNoReactWarnings } from "#test/react.ts";

expectNoReactWarnings();

app.it(
	"a save commits, a rejected write rolls back, and Bob cannot read Alice's order",
	[realPostgres(), aliceHasOrder("paper")],
	function* ({ saveOrder, rejectOrder, bobCannotRead, storedOrderIs, changesAre }) {
		yield* saveOrder("paper", "Office chairs", 8);
		yield* storedOrderIs("paper", "Office chairs", 8);
		yield* changesAre(1);
		yield* rejectOrder("paper", -1);
		yield* storedOrderIs("paper", "Office chairs", 8);
		yield* changesAre(1);
		yield* bobCannotRead("paper");
	},
);

app.it(
	"a React action refreshes the list after its HTTP save commits",
	[realPostgres(), aliceHasOrder("paper"), orderListIsOpen("paper")],
	function* ({ listShows, renameFromList, storedOrderIs }) {
		yield* listShows("Printer paper / 3");
		yield* renameFromList();
		yield* listShows("Office chairs / 8");
		yield* storedOrderIs("paper", "Office chairs", 8);
	},
);

app.it(
	"a rejected form preserves its draft and storage, then saves corrected decoded input",
	[realPostgres(), aliceHasOrder("paper"), orderEditorIsOpen("paper")],
	function* ({ formIsReady, editQuantity, submitOrder, formShowsError, quantityDraftIs, storedOrderIs, formIsSaved }) {
		yield* formIsReady();
		yield* editQuantity("-1");
		yield* submitOrder();
		yield* formShowsError("Quantity must be a whole number between 0 and 5000");
		yield* quantityDraftIs("-1");
		yield* storedOrderIs("paper", "Printer paper", 3);
		yield* editQuantity("12");
		yield* submitOrder();
		yield* formIsSaved();
		yield* storedOrderIs("paper", "Printer paper", 12);
	},
);

if (hasPostgres) {
	app.fails(
		"a failing story still unmounts and resets",
		[realPostgres(), aliceHasOrder("paper"), orderEditorIsOpen("paper")],
		function* ({ formIsReady, saveOrder }) {
			yield* formIsReady();
			yield* saveOrder("paper", "Before failure", 9);
			yield* Effect.fail("intentional cleanup failure");
		},
	);
}

localApp.it(
	"local rollback shares the worker database and prevents publication and independent reads",
	[localOrder()],
	function* ({ sharesWorkerDatabase, saveLocally, rejectLocally, observerSeesNoOrders, nothingWasPublished }) {
		yield* sharesWorkerDatabase();
		yield* saveLocally();
		yield* rejectLocally();
		yield* observerSeesNoOrders();
		yield* nothingWasPublished();
	},
);

app.it(
	"the next story sees empty tables, restarted identities and the migration ledger",
	[realPostgres(), aliceHasOrder("paper")],
	function* ({ orderIdIs, storedOrderIs }) {
		yield* orderIdIs("paper", 1);
		yield* storedOrderIs("paper", "Printer paper", 3);
	},
);
