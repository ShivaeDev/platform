import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes, hookFails, hookRecords, hookWritesNote } from "#test/kit.ts";

changes.it(
	"the hook runs once, at the outer transaction's commit, with ada's change and bob's committed savepoint and without cyd's rolled-back one",
	[hookRecords()],
	function* ({ inTransaction, write, rollback, hookCalls }) {
		yield* inTransaction(function* () {
			yield* write("ada's order", change("ada"));
			yield* inTransaction(write("bob's order", change("bob"), change("ada")));
			yield* inTransaction(function* () {
				yield* write("cyd's order", change("cyd"));
				yield* rollback();
			});
			expect(yield* hookCalls()).toEqual([]);
		});

		expect(yield* hookCalls()).toEqual(["the configured hook sees ada:orders, bob:orders"]);
	},
);

changes.it(
	"a hook that fails rolls ada's order back, ends the transaction with the hook's failure and publishes nothing",
	[hookFails("notify failed")],
	function* ({ saveOrder, orderEnding, committedRows, published }) {
		yield* saveOrder("ada");

		yield* outcomes({
			"committed rows": [committedRows(), []],
			"how the transaction ended": [orderEnding(), "notify failed"],
			"published changes": [published(), []],
		});
	},
);

changes.it("a transaction that records nothing does not run the hook", [hookRecords()], function* ({ inTransaction, write, hookCalls }) {
	yield* inTransaction(write("ada's order"));

	expect(yield* hookCalls()).toEqual([]);
});

changes.it("a transaction that rolls back does not run the hook", [hookRecords()], function* ({ inTransaction, write, rollback, hookCalls }) {
	yield* inTransaction(function* () {
		yield* write("ada's order", change("ada"));
		yield* rollback();
	});

	expect(yield* hookCalls()).toEqual([]);
});

for (const place of ["outside any transaction", "in a batch"] as const) {
	changes.it(`a write ${place} does not run the hook`, [hookRecords()], function* ({ inPlace, write, hookCalls }) {
		yield* inPlace(place, write("ada's order", change("ada")));

		expect(yield* hookCalls()).toEqual([]);
	});
}

changes.it(
	"a hook provided for a scope runs in place of the configured hook",
	[hookRecords()],
	function* ({ withScopedHook, inTransaction, write, hookCalls }) {
		yield* withScopedHook(inTransaction(write("ada's order", change("ada"))));

		expect(yield* hookCalls()).toEqual(["the scoped hook sees ada:orders"]);
	},
);

changes.it(
	"a driver whose transaction opened inside a hook's scope runs that scoped hook with ada's change",
	[],
	function* ({ withScopedHook, driverOpens, hookCalls }) {
		const transaction = yield* withScopedHook(driverOpens());
		yield* transaction.record(change("ada"));

		yield* transaction.runHook();

		expect(yield* hookCalls()).toEqual(["the scoped hook sees ada:orders"]);
	},
);

changes.it(
	"the hook writes the note its caller provides over the one present at open, through the database the transaction opened on",
	[hookWritesNote()],
	function* ({ driverOpens, committedRows }) {
		const transaction = yield* driverOpens({ note: "the note at open" });
		yield* transaction.record(change("ada"));

		yield* transaction.runHook({ note: "the caller's note" });

		expect(yield* committedRows()).toEqual(["the caller's note"]);
	},
);
