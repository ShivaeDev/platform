import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { change } from "#test/fakeDatabase.ts";
import { changes } from "#test/kit.ts";

for (const failure of ["a synchronous throw", "a defect"] as const) {
	for (const event of ["Recorded", "Published"] as const) {
		changes.it(
			`an observer failing with ${failure} on ${event} logs the failure, leaves ada's order committed and delivers her change to the sink`,
			[],
			function* ({ withFailingObserver, saveOrder, orderEnding, committedRows, published, loggedErrors }) {
				yield* withFailingObserver(failure, event, saveOrder("ada"));

				yield* outcomes([
					["committed rows", () => committedRows(), ["ada's order"]],
					["transaction ending", () => orderEnding(), "committed"],
					["sink delivery", () => published(), [["ada:orders"]]],
					["observer error", () => loggedErrors(), [{ channel: "Test", message: expect.stringContaining("observer failed") }]],
				]);
			},
		);
	}

	changes.it(
		`an observer failing with ${failure} on Discarded still lets ada's enclosing transaction publish after bob's rollback`,
		[],
		function* ({ withFailingObserver, inTransaction, write, rollback, published }) {
			yield* withFailingObserver(
				failure,
				"Discarded",
				inTransaction(function* () {
					yield* write("ada's order", change("ada"));
					yield* inTransaction(function* () {
						yield* write("bob's order", change("bob"));
						yield* rollback();
					});
				}),
			);

			expect(yield* published()).toEqual([["ada:orders"]]);
		},
	);
}
