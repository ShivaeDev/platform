import { databases, twoLeasesAreOpen } from "#test/order-example/databaseKit.ts";

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

databases.it(
	"overlapping stories serialize resets so one story cannot erase another story's committed rows",
	[],
	function* ({ overlappingStoriesKeepTheirRows }) {
		yield* overlappingStoriesKeepTheirRows();
	},
);
