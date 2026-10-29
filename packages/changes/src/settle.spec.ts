import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes } from "#test/kit.ts";

changes.it(
	"a driver that commits ada's transaction again and then rolls it back still has published her change only once",
	[],
	function* ({ driverOpens, published }) {
		const transaction = yield* driverOpens();
		yield* transaction.record(change("ada"));
		yield* transaction.commit();
		expect(yield* published()).toEqual([["ada:orders"]]);

		yield* transaction.commit();
		yield* transaction.rollBack();

		expect(yield* published()).toEqual([["ada:orders"]]);
	},
);

changes.it("a driver that commits ada's transaction after rolling it back publishes nothing", [], function* ({ driverOpens, published }) {
	const transaction = yield* driverOpens();
	yield* transaction.record(change("ada"));
	yield* transaction.rollBack();

	yield* transaction.commit();

	expect(yield* published()).toEqual([]);
});

for (const work of ["record bob's change", "open a transaction for bob's order"] as const) {
	changes.it(
		`a fiber that outlives ada's transaction and then tries to ${work} dies, leaving only ada's order committed and published`,
		[],
		function* ({ saveOrderLeavingStraggler, stragglerResumes, stragglerEnding, committedRows, published }) {
			yield* saveOrderLeavingStraggler("ada", work);
			expect(yield* published()).toEqual([["ada:orders"]]);

			yield* stragglerResumes();

			yield* outcomes({
				"committed rows": [committedRows(), ["ada's order"]],
				"how the straggler ended": [stragglerEnding(), "died"],
				"published changes": [published(), [["ada:orders"]]],
			});
		},
	);
}

changes.it(
	"a Promise driver that commits publishes ada's change after her transaction body, not during it",
	[],
	function* ({ promiseDriver, record, published }) {
		yield* promiseDriver("commits", function* () {
			yield* record(change("ada"));
			expect(yield* published()).toEqual([]);
		});

		expect(yield* published()).toEqual([["ada:orders"]]);
	},
);

changes.it("a Promise driver whose commit fails after ada's body succeeded publishes nothing", [], function* ({ promiseDriver, record, published }) {
	yield* promiseDriver("fails to commit", record(change("ada")));

	expect(yield* published()).toEqual([]);
});

changes.it(
	"dan's savepoint that commits after its transaction already committed dies, and dan's change is not published",
	[],
	function* ({ driverOpens, published }) {
		const transaction = yield* driverOpens();
		const savepoint = yield* transaction.openSavepoint();
		yield* savepoint.record(change("dan"));
		yield* transaction.commit();

		yield* savepoint.commit();

		yield* outcomes({
			"how the savepoint's commit ended": [savepoint.ending(), "died"],
			"published changes": [published(), []],
		});
	},
);
