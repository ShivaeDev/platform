import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app } from "#test/order-example/app.ts";
import { aliceHasOrder, orderListIsOpen } from "#test/order-example/traits.ts";

expectNoReactWarnings();

app.it(
	"a save through the HTTP API commits and publishes an orders change",
	[aliceHasOrder("paper")],
	function* ({ changes, saveOrder, storedOrder }) {
		yield* saveOrder("paper", "Office chairs", 8);

		yield* outcomes([
			["changes", () => changes(), ["orders"]],
			["stored", () => storedOrder("paper"), "Office chairs / 8"],
		]);
	},
);

app.it("a rejected write rolls back and publishes nothing", [aliceHasOrder("paper")], function* ({ answers, changes, rejectOrder, storedOrder }) {
	yield* rejectOrder("paper", -1);

	yield* outcomes([
		["answers", () => answers(), ["rejected as OrderValidation on quantity"]],
		["changes", () => changes(), []],
		["stored", () => storedOrder("paper"), "Printer paper / 3"],
	]);
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

		yield* outcomes([
			["list", () => list(), ["Office chairs / 8"]],
			["stored", () => storedOrder("paper"), "Office chairs / 8"],
		]);
	},
);
