import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app } from "#test/order-example/app.ts";
import { databases } from "#test/order-example/databaseKit.ts";
import { localApplication } from "#test/order-example/localApplication.ts";
import { aliceHasOrder, orderListIsOpen } from "#test/order-example/traits.ts";

expectNoReactWarnings();

app.it(
	"a save through the HTTP API commits and publishes an orders change",
	[aliceHasOrder("paper")],
	function* ({ changes, saveOrder, storedOrder }) {
		yield* saveOrder("paper", "Office chairs", 8);

		yield* outcomes({
			changes: [changes(), ["orders"]],
			stored: [storedOrder("paper"), "Office chairs / 8"],
		});
	},
);

app.it("a rejected write rolls back and publishes nothing", [aliceHasOrder("paper")], function* ({ answers, changes, rejectOrder, storedOrder }) {
	yield* rejectOrder("paper", -1);

	yield* outcomes({
		answers: [answers(), ["rejected as OrderValidation on quantity"]],
		changes: [changes(), []],
		stored: [storedOrder("paper"), "Printer paper / 3"],
	});
});

app.it("Bob cannot read Alice's order", [aliceHasOrder("paper")], function* ({ answers, readAsBob }) {
	yield* readAsBob("paper");

	expect(yield* answers()).toEqual(["rejected as OrderNotFound"]);
});

app.it(
	"a React action refreshes the list after its HTTP save commits",
	[aliceHasOrder("paper"), orderListIsOpen("paper")],
	function* ({ list, renameFromList, storedOrder }) {
		yield* renameFromList();

		yield* outcomes({
			list: [list(), ["Office chairs / 8"]],
			stored: [storedOrder("paper"), "Office chairs / 8"],
		});
	},
);

app.it("a story starts from migrated, empty tables with no screen left open", [], function* ({ startingState }) {
	expect(yield* startingState()).toEqual({ migrations: [{ "migration_id": 1 }], openScreens: 0, orders: [] });
});

localApplication.it(
	"a rolled-back story keeps its writes and changes from other connections",
	[],
	function* ({ changes, insideRollback, observerOrders, rollbackStory }) {
		yield* rollbackStory();

		yield* outcomes({
			"changes afterwards": [changes(), []],
			inside: [insideRollback(), { changes: [], observerOrders: [], rejected: "rejected as OrderValidation on quantity", saved: "Local save / 12" }],
			"orders afterwards": [observerOrders(), []],
		});
	},
);

databases.it(
	"a failing application story still closes its screens and resets the tables",
	[],
	function* ({ failingStoryReport, runFailingApplicationStory }) {
		yield* runFailingApplicationStory();

		expect(yield* failingStoryReport()).toEqual({
			"failing story": "failed",
			"next story's first order id": 1,
			"open screens": 0,
			"orders afterwards": 0,
		});
	},
);
