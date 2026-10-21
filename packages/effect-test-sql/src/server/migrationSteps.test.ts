import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { app, migrationTarget } from "#test/migrationStory.ts";

app.it(
	"backfills seeded old-schema rows before dropping their column on the same isolated PostgreSQL database",
	[],
	function* ({ openObserver, readTable, migrateTo, seedContacts, backfill, readEmails, readContacts, readLedger, readLoads }) {
		const observer = yield* openObserver();
		expect(yield* readTable("contacts")).toEqual([{ name: null }]);
		yield* migrateTo("1_create_contacts");
		yield* seedContacts();
		expect(yield* observer`select email from contacts order by id`).toEqual([{ email: "alice@example.test" }, { email: "bob@example.test" }]);
		yield* backfill();
		expect(yield* readEmails()).toEqual([
			{ address: "alice@example.test", "contact_id": 1 },
			{ address: "bob@example.test", "contact_id": 2 },
		]);
		expect(yield* observer`select contact_id, address from emails order by contact_id`).toEqual([
			{ address: "alice@example.test", "contact_id": 1 },
			{ address: "bob@example.test", "contact_id": 2 },
		]);
		expect(yield* readContacts().pipe(Effect.flip)).toMatchObject({ _tag: "SqlError" });
		expect(yield* readLedger()).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }, { "migration_id": 3 }]);
		expect(yield* readLoads()).toBe(1);
	},
);
app.it(
	"unknown migration names fail with a typed error naming the migration before changing the schema",
	[migrationTarget("missing_backfill")],
	function* ({ migrateTo, readTable }) {
		const error = yield* migrateTo().pipe(Effect.flip);
		expect(error).toBeInstanceOf(Migrator.MigrationError);
		expect(error).toMatchObject({ kind: "BadState", message: 'Migration "missing_backfill" is not in the loader.' });
		expect(yield* readTable("contacts")).toEqual([{ name: null }]);
	},
);
app.it("migration steps reject wrapping transactions even when acquired outside one", [], function* ({ acquireInTransaction, migrateInTransaction }) {
	for (const effect of [acquireInTransaction().pipe(Effect.asVoid), migrateInTransaction().pipe(Effect.asVoid)]) {
		expect(yield* effect.pipe(Effect.flip)).toMatchObject({
			_tag: "MigrationError",
			kind: "BadState",
			message: "Migration steps must run outside a wrapping transaction.",
		});
	}
});
