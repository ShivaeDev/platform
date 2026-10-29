import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes, guardRefuses, guardWatches } from "#test/kit.ts";

changes.it("a write outside any transaction asks the unowned guard about main", [guardWatches()], function* ({ write, guardAsked }) {
	yield* write("ada's order", change("ada"));

	expect(yield* guardAsked()).toEqual(["main"]);
});

changes.it(
	"a transaction asks the unowned guard once when it opens, and its writes and savepoints do not ask again",
	[guardWatches()],
	function* ({ inTransaction, write, guardAsked }) {
		yield* inTransaction(function* () {
			yield* write("ada's order", change("ada"));
			yield* inTransaction(write("bob's order", change("bob")));
		});

		expect(yield* guardAsked()).toEqual(["main"]);
	},
);

changes.it(
	"a write inside a batch still asks the unowned guard, because a batch owns no transaction",
	[guardWatches()],
	function* ({ batch, write, guardAsked }) {
		yield* batch(write("ada's order", change("ada")));

		expect(yield* guardAsked()).toEqual(["main"]);
	},
);

changes.it(
	"a transaction opened inside a batch asks the unowned guard when it opens, and its writes do not ask again",
	[guardWatches()],
	function* ({ batch, inTransaction, write, guardAsked }) {
		yield* batch(inTransaction(write("ada's order", change("ada"))));

		expect(yield* guardAsked()).toEqual(["main"]);
	},
);

changes.it(
	"when the unowned guard refuses, ada's order saved outside any transaction dies before her change is published",
	[guardRefuses()],
	function* ({ saveOrderWithoutTransaction, orderEnding, published }) {
		yield* saveOrderWithoutTransaction("ada");

		yield* outcomes({
			"how the save ended": [orderEnding(), "died"],
			"published changes": [published(), []],
		});
	},
);

changes.it(
	"when the unowned guard refuses, ada's order transaction dies before its body writes anything",
	[guardRefuses()],
	function* ({ saveOrder, orderEnding, committedRows, published }) {
		yield* saveOrder("ada");

		yield* outcomes({
			"committed rows": [committedRows(), []],
			"how the transaction ended": [orderEnding(), "died"],
			"published changes": [published(), []],
		});
	},
);
