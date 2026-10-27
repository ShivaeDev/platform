import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { databases, twoLeasesAreOpen } from "#test/order-example/databaseKit.ts";

databases.it(
	"database leases share one disposable database, close pools before the last drop, and preserve the migration ledger",
	[twoLeasesAreOpen()],
	function* ({ leaseDatabases, closeLease, migrationLedger, database }) {
		const names = yield* leaseDatabases();
		expect(names).toEqual([expect.stringMatching(/^platform_story_/u), names[0]]);
		yield* closeLease("first");
		expect(yield* migrationLedger("second")).toEqual([{ "migration_id": 1 }]);
		yield* closeLease("second");
		const dropped = yield* database();
		expect(dropped.name).toMatch(/^platform_story_/u);
		expect(dropped.rows).toEqual([]);
	},
);

databases.it(
	"a failed acquisition after pool setup releases the database, and impossible seeds insert nothing",
	[],
	function* ({ setupFailsAfterRejectingSeed, database }) {
		const failed = yield* setupFailsAfterRejectingSeed();
		expect(failed.seed).toMatchObject({ _tag: "Failure" });
		expect(failed.rows).toEqual([]);
		expect(failed.exit).toEqual(Exit.fail("application setup failed after database acquisition"));
		const dropped = yield* database();
		expect(dropped.name).toMatch(/^platform_story_/u);
		expect(dropped.rows).toEqual([]);
	},
);

databases.it("migration failure during database acquisition closes pools and releases the lease", [], function* ({ migrationFails, database }) {
	const exit = yield* migrationFails();
	expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe("migration setup failed");
	const dropped = yield* database();
	expect(dropped.name).toMatch(/^platform_story_/u);
	expect(dropped.rows).toEqual([]);
});

databases.it("interruption closes the database pools and drops the worker database", [], function* ({ startLongQuery, interruptQuery, database }) {
	yield* startLongQuery();
	yield* interruptQuery();
	const dropped = yield* database();
	expect(dropped.name).toMatch(/^platform_story_/u);
	expect(dropped.rows).toEqual([]);
});

databases.it("overlapping stories serialize resets so one story cannot erase another story's committed rows", [], function* ({ overlappingStories }) {
	expect(yield* overlappingStories()).toEqual({
		firstRows: [{ name: "First" }],
		remaining: [],
		secondRows: { initial: [], saved: [{ name: "Second" }] },
	});
});
