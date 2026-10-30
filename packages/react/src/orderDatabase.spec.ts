import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { databases, leasesAreOpen } from "#test/order-example/databaseKit.ts";

databases.it("two leases share one disposable database with usable pools", [leasesAreOpen()], function* ({ leaseDatabases }) {
	const [first, second] = yield* leaseDatabases();

	expect([first, second]).toEqual([expect.stringMatching(/^platform_story_[a-f0-9]{32}$/u), first]);
});

databases.it(
	"closing one lease keeps the database and its migration ledger for the other",
	[leasesAreOpen()],
	function* ({ closeLease, database, migrationLedger }) {
		yield* closeLease("first");

		yield* outcomes({
			database: [database(), "still exists"],
			"second lease's ledger": [migrationLedger("second"), [{ "migration_id": 1 }]],
		});
	},
);

databases.it("closing the last lease drops the database", [leasesAreOpen(["first"])], function* ({ closeLease, database }) {
	yield* closeLease("first");

	expect(yield* database()).toBe("dropped");
});

databases.it("application setup that fails after acquiring the database releases it", [], function* ({ database, setup, setupFails }) {
	yield* setupFails();

	yield* outcomes({
		database: [database(), "dropped"],
		setup: [setup(), "failed: application setup failed after database acquisition"],
	});
});

databases.it(
	"a migration that fails during acquisition closes the pools and releases the lease",
	[],
	function* ({ database, migrationFails, setup }) {
		yield* migrationFails();

		yield* outcomes({
			database: [database(), "dropped"],
			setup: [setup(), "failed: migration setup failed"],
		});
	},
);

databases.it("interrupting a query closes its pools and drops the database", [], function* ({ database, interruptQuery, startLongQuery }) {
	yield* startLongQuery();

	yield* interruptQuery();

	expect(yield* database()).toBe("dropped");
});

databases.it("overlapping stories run one at a time, each starting from empty tables", [], function* ({ overlappingReport, runOverlappingStories }) {
	yield* runOverlappingStories();

	expect(yield* overlappingReport()).toEqual({
		afterwards: [],
		"first story saw": ["First"],
		"second story saw": ["Second"],
		"second story started with": [],
	});
});
