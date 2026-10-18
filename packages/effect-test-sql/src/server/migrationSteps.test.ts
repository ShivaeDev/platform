import { app, migrationTarget } from "#test/migrationStory.ts";

app.it(
	"backfills seeded old-schema rows before dropping their column on the same isolated PostgreSQL database",
	[],
	function* ({ backfillCommitsEachStep }) {
		yield* backfillCommitsEachStep();
	},
);

app.it(
	"unknown migration names fail with a typed error naming the migration before changing the schema",
	[migrationTarget("missing_backfill")],
	function* ({ targetIsRejected }) {
		yield* targetIsRejected("not in");
	},
);

app.it("migration steps reject wrapping transactions even when acquired outside one", [], function* ({ wrappingTransactionsAreRejected }) {
	yield* wrappingTransactionsAreRejected();
});
