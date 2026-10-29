import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes } from "#test/kit.ts";

for (const place of ["in a transaction", "outside any transaction", "in a driver's transaction"] as const) {
	changes.it(
		`a sink provided for a scope receives ada's change written ${place}, and the configured sink receives nothing`,
		[],
		function* ({ withScopedSink, inPlace, write, scopedSinkReceived, published }) {
			yield* withScopedSink(inPlace(place, write("ada's order", change("ada"))));

			yield* outcomes({
				"configured sink": [published(), []],
				"scoped sink": [scopedSinkReceived(), [["ada:orders"]]],
			});
		},
	);
}

changes.it(
	"a committed-changes sink receives ada's change from a transaction in place of the configured sink",
	[],
	function* ({ withCommittedSink, inTransaction, write, committedSinkReceived, published }) {
		yield* withCommittedSink(inTransaction(write("ada's order", change("ada"))));

		yield* outcomes({
			"committed-changes sink": [committedSinkReceived(), [["ada:orders"]]],
			"configured sink": [published(), []],
		});
	},
);

for (const place of ["outside any transaction", "in a batch"] as const) {
	changes.it(
		`a committed-changes sink leaves ada's change written ${place} to the configured sink`,
		[],
		function* ({ withCommittedSink, inPlace, write, committedSinkReceived, published }) {
			yield* withCommittedSink(inPlace(place, write("ada's order", change("ada"))));

			yield* outcomes({
				"committed-changes sink": [committedSinkReceived(), []],
				"configured sink": [published(), [["ada:orders"]]],
			});
		},
	);
}

changes.it(
	"the observer sees ada's change recorded and then published when her transaction commits",
	[],
	function* ({ observing, inTransaction, write, observed }) {
		yield* observing(inTransaction(write("ada's order", change("ada"))));

		expect(yield* observed()).toEqual(["ada:orders recorded", "ada:orders published"]);
	},
);

changes.it(
	"the observer sees bob's change recorded and then discarded when his transaction rolls back",
	[],
	function* ({ observing, inTransaction, write, rollback, observed }) {
		yield* observing(
			inTransaction(function* () {
				yield* write("bob's order", change("bob"));
				yield* rollback();
			}),
		);

		expect(yield* observed()).toEqual(["bob:orders recorded", "bob:orders discarded"]);
	},
);

changes.it(
	"the observer sees bob's change discarded when his savepoint rolls back, and ada's published when her transaction commits",
	[],
	function* ({ observing, inTransaction, write, rollback, observed }) {
		yield* observing(
			inTransaction(function* () {
				yield* write("ada's order", change("ada"));
				yield* inTransaction(function* () {
					yield* write("bob's order", change("bob"));
					yield* rollback();
				});
			}),
		);

		expect(yield* observed()).toEqual(["ada:orders recorded", "bob:orders recorded", "bob:orders discarded", "ada:orders published"]);
	},
);

changes.it("the observer sees a write outside any transaction recorded once and published at once", [], function* ({ observing, write, observed }) {
	yield* observing(write("ada's order", change("ada"), change("ada")));

	expect(yield* observed()).toEqual(["ada:orders recorded", "ada:orders published"]);
});

changes.it("the observer sees ada's change published before the sink receives it", [], function* ({ observing, inTransaction, write, timeline }) {
	yield* observing(inTransaction(write("ada's order", change("ada"))));

	expect(yield* timeline()).toEqual([
		"the observer sees ada:orders recorded",
		"the observer sees ada:orders published",
		"the sink receives ada:orders",
	]);
});
