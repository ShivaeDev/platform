import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

database.it("rollback releases a shared row lock before another test writes the same key", [poolLimit(3)], function* ({ rollbackReleasesRowLock }) {
	yield* rollbackReleasesRowLock();
});
