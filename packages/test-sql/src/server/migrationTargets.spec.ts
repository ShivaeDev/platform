import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ambiguousLoader, app } from "#test/migrationStory.ts";

for (const target of ["002_backfill_emails", "2_backfill_emails", 2, "2", "002"]) {
	app.it(`migrating to ${JSON.stringify(target)} applies migrations 1 and 2 and stops there`, [], function* ({ appliedMigrations, migrateTo }) {
		expect(yield* appliedMigrations()).toEqual([]);

		yield* migrateTo(target);

		expect(yield* appliedMigrations()).toEqual([1, 2]);
	});
}

for (const target of ["002_missing", "missing_backfill", "999", 999]) {
	app.it(`migrating to ${JSON.stringify(target)} fails as not in the loader and creates no table`, [], function* ({ migrateTo, migration, tables }) {
		yield* migrateTo(target);

		yield* outcomes({
			tables: [tables(), []],
			"the migration": [migration(), `failed with BadState: Migration "${target}" is not in the loader.`],
		});
	});
}

for (const target of ["001_create_contacts", "1_create_contacts", 1, "001"]) {
	app.it(
		`with two migrations named 1 create_contacts, migrating to ${JSON.stringify(target)} fails as ambiguous and creates no table`,
		[ambiguousLoader],
		function* ({ migrateTo, migration, tables }) {
			yield* migrateTo(target);

			yield* outcomes({
				tables: [tables(), []],
				"the migration": [migration(), `failed with BadState: Migration "${target}" is ambiguous in the loader.`],
			});
		},
	);
}
