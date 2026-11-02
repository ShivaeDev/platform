import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes, sinkFails } from "#test/kit.ts";

changes.it(
	"capture reports recorded changes, discarded savepoint changes and the distinct publication attempt while delivery and the enclosing observer still run",
	[],
	function* ({ capturing, observing, inTransaction, write, rollback, recordedChanges, attemptedChanges, discardedChanges, published, observed }) {
		yield* observing(
			capturing(
				inTransaction(function* () {
					yield* write("ada's order", change("ada"), change("ada"));
					yield* inTransaction(function* () {
						yield* write("bob's order", change("bob"));
						yield* rollback();
					});
					yield* write("ada's second order", change("ada"));
				}),
			),
		);

		yield* outcomes([
			["recorded changes", () => recordedChanges(), [["ada:orders"], ["bob:orders"], ["ada:orders"]]],
			["attempted changes", () => attemptedChanges(), [["ada:orders"]]],
			["discarded changes", () => discardedChanges(), [["bob:orders"]]],
			["sink delivery", () => published(), [["ada:orders"]]],
			[
				"enclosing observer",
				() => observed(),
				["ada:orders recorded", "bob:orders recorded", "bob:orders discarded", "ada:orders recorded", "ada:orders published"],
			],
		]);
	},
);

changes.it(
	"capture reports a publication attempt when delivery fails",
	[sinkFails("a failed Effect", "the sink is unavailable")],
	function* ({ capturing, inTransaction, write, attemptedChanges, discardedChanges, loggedErrors }) {
		yield* capturing(inTransaction(write("ada's order", change("ada"))));

		yield* outcomes([
			["attempted changes", () => attemptedChanges(), [["ada:orders"]]],
			["discarded changes", () => discardedChanges(), []],
			["delivery error", () => loggedErrors(), [{ message: "Changes.publish failed after the changes were committed; the committed result stands" }]],
		]);
	},
);

changes.it(
	"capture leaves writes outside its Layer out of its readouts",
	[],
	function* ({ capturing, write, recordedChanges, attemptedChanges, published }) {
		yield* capturing(write("ada's order", change("ada")));
		yield* write("bob's order", change("bob"));

		yield* outcomes([
			["recorded changes", () => recordedChanges(), [["ada:orders"]]],
			["attempted changes", () => attemptedChanges(), [["ada:orders"]]],
			["sink delivery", () => published(), [["ada:orders"], ["bob:orders"]]],
		]);
	},
);
