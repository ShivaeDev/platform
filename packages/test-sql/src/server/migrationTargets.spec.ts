import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { ambiguousLoader, app, migrationTarget } from "#test/migrationStory.ts";

for (const target of ["002_backfill_emails", "2_backfill_emails", 2, "2", "002"]) {
	app.it(
		`migration target ${JSON.stringify(target)} stops at the same migration on PostgreSQL`,
		[migrationTarget(target)],
		function* ({ migrateTo, readLedger, readContacts, readAddresses }) {
			yield* migrateTo();
			expect(yield* readLedger()).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }]);
			expect(yield* readContacts()).toEqual([]);
			expect(yield* readAddresses()).toEqual([]);
		},
	);
}
for (const [reason, targets] of [
	["not in", ["002_missing", "999", 999]],
	["ambiguous in", ["001_create_contacts", "1_create_contacts", 1, "001"]],
] as const) {
	for (const target of targets) {
		app.it(
			`${reason === "not in" ? "unknown" : "ambiguous"} migration target ${JSON.stringify(target)} fails before changing PostgreSQL`,
			[migrationTarget(target), ...(reason === "ambiguous in" ? [ambiguousLoader] : [])],
			function* ({ migrateTo, readTable }) {
				const error = yield* migrateTo().pipe(Effect.flip);
				expect(error).toBeInstanceOf(Migrator.MigrationError);
				expect(error).toMatchObject({ kind: "BadState", message: `Migration "${target}" is ${reason} the loader.` });
				expect(yield* readTable(reason === "not in" ? "contacts" : "ledger")).toEqual([{ name: null }]);
			},
		);
	}
}
