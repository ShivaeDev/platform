import { ambiguousLoader, app, migrationTarget } from "#test/migrationStory.ts";

for (const target of ["002_backfill_emails", "2_backfill_emails", 2, "2", "002"]) {
	app.it(
		`migration target ${JSON.stringify(target)} stops at the same migration on PostgreSQL`,
		[migrationTarget(target)],
		function* ({ targetStopsAtBackfill }) {
			yield* targetStopsAtBackfill();
		},
	);
}

for (const target of ["002_missing", "999", 999]) {
	app.it(
		`unknown migration target ${JSON.stringify(target)} retains its typed error on PostgreSQL`,
		[migrationTarget(target)],
		function* ({ targetIsRejected }) {
			yield* targetIsRejected("not in");
		},
	);
}

for (const target of ["001_create_contacts", "1_create_contacts", 1, "001"]) {
	app.it(
		`ambiguous migration target ${JSON.stringify(target)} fails before changing PostgreSQL`,
		[migrationTarget(target), ambiguousLoader],
		function* ({ targetIsRejected }) {
			yield* targetIsRejected("ambiguous in");
		},
	);
}
