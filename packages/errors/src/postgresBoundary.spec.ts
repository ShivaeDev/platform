import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Conflict, InternalServerError, ServiceUnavailable } from "#taxonomy.ts";
import { postgresBoundary, shoppingLockedElsewhere } from "#test/postgresBoundary.ts";

postgresBoundary.it(
	"a rename that hits its lock timeout answers ServiceUnavailable without an unexpected report",
	[shoppingLockedElsewhere()],
	function* ({ answer, recordedReports, renameShopping }) {
		yield* renameShopping("Groceries");

		yield* outcomes([
			["answer", () => answer(), expect.any(ServiceUnavailable)],
			["unexpected reports", () => recordedReports(), []],
		]);
	},
);

postgresBoundary.it(
	"a rename to a taken title that nothing maps answers the internal rejection and reports the unique violation",
	[],
	function* ({ answer, recordedReports, renameShopping }) {
		yield* renameShopping("Errands");

		yield* outcomes([
			["answer", () => answer(), expect.any(InternalServerError)],
			[
				"unexpected reports",
				() => recordedReports(),
				[{ failures: [expect.objectContaining({ reason: expect.objectContaining({ _tag: "UniqueViolation" }) })] }],
			],
		]);
	},
);

postgresBoundary.it("a rename to a taken title answers the Conflict its RPC declares", [], function* ({ answer, renameShoppingOrConflict }) {
	yield* renameShoppingOrConflict("Errands");

	expect(yield* answer()).toEqual(new Conflict({ field: "title", message: "Title is taken" }));
});
