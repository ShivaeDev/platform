import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "#database.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { emails, expectedEmails, migrations, runSteps, seedContacts } from "#test/migrationSteps.ts";
import { integration, secondClient } from "#test/postgres.ts";
import { withTestTransaction } from "#withTestTransaction.ts";

integration("backfills seeded old-schema rows before dropping their column on the same isolated PostgreSQL database", async () => {
	let loads = 0;
	await Effect.runPromise(
		runSteps(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const database = yield* PostgresTestDatabase;
				const observer = yield* secondClient(database.url);
				const loader = Effect.map(migrations.loader, (resolved) => {
					loads += 1;
					return resolved;
				});
				const steps = yield* migrationSteps({ ...migrations, loader });
				expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
				yield* steps.migrateTo("1_create_contacts");
				yield* seedContacts;
				expect(yield* observer`select email from contacts order by id`).toEqual([{ email: "alice@example.test" }, { email: "bob@example.test" }]);
				yield* steps.migrateToLatest;
				expect(yield* emails).toEqual(expectedEmails);
				expect(yield* observer`select contact_id, address from emails order by contact_id`).toEqual(expectedEmails);
				expect(yield* sql`select email from contacts`.pipe(Effect.flip)).toMatchObject({ _tag: "SqlError" });
				expect(yield* sql`select migration_id from ${sql(migrations.table)} order by migration_id`).toEqual([
					{ "migration_id": 1 },
					{ "migration_id": 2 },
					{ "migration_id": 3 },
				]);
			}),
		),
	);
	expect(loads).toBe(1);
});

integration("unknown migration names fail with a typed error naming the migration before changing the schema", async () => {
	await Effect.runPromise(
		runSteps(
			Effect.gen(function* () {
				const steps = yield* migrationSteps(migrations);
				const error = yield* steps.migrateTo("missing_backfill").pipe(Effect.flip);
				expect(error).toBeInstanceOf(Migrator.MigrationError);
				expect(error).toMatchObject({ kind: "BadState", message: 'Migration "missing_backfill" is not in the loader.' });
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
			}),
		),
	);
});

integration("migration steps reject wrapping transactions even when acquired outside one", async () => {
	await Effect.runPromise(
		runSteps(
			Effect.gen(function* () {
				const steps = yield* migrationSteps(migrations);
				for (const effect of [
					withTestTransaction(migrationSteps(migrations)).pipe(Effect.asVoid),
					withTestTransaction(steps.migrateToLatest).pipe(Effect.asVoid),
				]) {
					expect(yield* effect.pipe(Effect.flip)).toMatchObject({
						_tag: "MigrationError",
						kind: "BadState",
						message: "Migration steps must run outside a wrapping transaction.",
					});
				}
			}),
		),
	);
});
