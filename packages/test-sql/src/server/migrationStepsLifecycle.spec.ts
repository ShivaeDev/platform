import { Effect } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";
import { emptyPreparation } from "#test/databaseTraits.ts";
import { app } from "#test/migrationStory.ts";

database.it(
	"empty preparation skips both migrations and fixtures on the shared database and isolated clones",
	[emptyPreparation],
	function* ({ readSharedSchema, readCloneSchema }) {
		expect(yield* readSharedSchema()).toEqual([{ name: null }]);
		expect(yield* readCloneSchema()).toEqual([{ name: null }]);
	},
);
app.it("steps retain loader failures and keep loader resources in the test scope", [], function* ({ loaderResourcesAreScoped }) {
	const observed = yield* loaderResourcesAreScoped();
	expect(observed.received).toBe(observed.failure);
	expect(observed.during).toEqual([false, false, false]);
	expect(observed.after).toBe(true);
});
app.it(
	"steps can stop again, resume from the ledger and reject going backwards",
	[],
	function* ({ migrateTo, readContacts, resume, backfill, readLedger }) {
		yield* migrateTo("1_create_contacts");
		yield* migrateTo("2_backfill_emails");
		expect(yield* readContacts()).toEqual([]);
		expect(yield* migrateTo("1_create_contacts").pipe(Effect.flip)).toMatchObject({
			_tag: "MigrationError",
			kind: "BadState",
			message: "Cannot migrate to 1: later migrations are already applied.",
		});
		yield* resume();
		yield* backfill();
		yield* backfill();
		expect(yield* readLedger()).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }, { "migration_id": 3 }]);
	},
);
