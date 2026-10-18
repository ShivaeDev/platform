import { expect, it } from "vitest";
import { databases, twoLeasesAreOpen } from "#test/order-example/databaseKit.ts";
import { disposableDestination } from "#test/order-example/postgres.ts";

databases.it(
	"database leases share one disposable database, close pools before the last drop, and preserve the migration ledger",
	[twoLeasesAreOpen()],
	function* ({ leasesShareDatabase, closeLease, migrationLedgerIsPreserved, databaseWasDropped }) {
		yield* leasesShareDatabase();
		yield* closeLease("first");
		yield* migrationLedgerIsPreserved("second");
		yield* closeLease("second");
		yield* databaseWasDropped();
	},
);

databases.it(
	"a failed acquisition after pool setup releases the database, and impossible seeds insert nothing",
	[],
	function* ({ setupFailsAfterRejectingSeed, databaseWasDropped }) {
		yield* setupFailsAfterRejectingSeed();
		yield* databaseWasDropped();
	},
);

databases.it(
	"migration failure during database acquisition closes pools and releases the lease",
	[],
	function* ({ migrationFails, databaseWasDropped }) {
		yield* migrationFails();
		yield* databaseWasDropped();
	},
);

databases.it(
	"interruption closes the database pools and drops the worker database",
	[],
	function* ({ startLongQuery, interruptQuery, databaseWasDropped }) {
		yield* startLongQuery();
		yield* interruptQuery();
		yield* databaseWasDropped();
	},
);

it("refuses unsafe destinations before opening a pool or resetting tables", () => {
	for (const url of [
		"postgresql://postgres:postgres@remote:55432/platform_test_effect_sql",
		"postgresql://postgres:postgres@127.0.0.1:55432/production",
		"postgresql://postgres:postgres@127.0.0.1:5432/platform_test_effect_sql",
		"postgresql://postgres:postgres@127.0.0.1:55432/platform_test_effect_sql?host=remote",
	]) {
		expect(() => disposableDestination(url)).toThrow("Use a local database");
	}
});

databases.it(
	"overlapping stories serialize resets so one story cannot erase another story's committed rows",
	[],
	function* ({ overlappingStoriesKeepTheirRows }) {
		yield* overlappingStoriesKeepTheirRows();
	},
);
