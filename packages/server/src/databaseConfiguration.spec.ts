import { expect } from "vitest";
import { databaseSetup, hasTestDatabase } from "#test/databaseSetup.ts";

databaseSetup.it.runIf(hasTestDatabase)(
	"preparing databases creates the names configured in their URLs instead of the package name",
	[],
	function* ({ connectedDatabases, prepareDatabases }) {
		yield* prepareDatabases();

		expect(yield* connectedDatabases()).toEqual({ "DATABASE_URL": "local_<unique>", "TEST_DATABASE_URL": "specs_<unique>" });
	},
);

for (const missing of ["DATABASE_URL", "TEST_DATABASE_URL"] as const) {
	databaseSetup.it(`preparing databases without ${missing} fails with a config error naming it`, [], function* ({ prepareDatabasesWithout }) {
		expect(yield* prepareDatabasesWithout(missing)).toBe(`failed with a config error about ${missing}`);
	});
}
