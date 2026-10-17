import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { migrationSteps } from "#migrationSteps.ts";
import { makePostgresTestLayer } from "#postgres.ts";
import { migrations, runSteps } from "#test/migrationSteps.ts";
import { adminUrl, integration } from "#test/postgres.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";

integration("empty preparation skips both migrations and fixtures on the shared database and isolated clones", async () => {
	const unprepared = makePostgresTestLayer({
		fixtures: Effect.die("fixtures must not run on an empty schema"),
		migrations: { ...migrations, loader: Effect.die("preparation must not load migrations") },
		prepare: false,
		url: adminUrl,
	});
	const empty = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
	});
	await Effect.runPromise(
		Effect.gen(function* () {
			yield* empty;
			yield* withIsolatedDatabase(empty);
		}).pipe(Effect.provide(unprepared)),
	);
});

integration("steps retain loader failures and keep loader resources in the test scope", async () => {
	let closed = false;
	await Effect.runPromise(
		runSteps(
			Effect.gen(function* () {
				const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader refused" });
				expect(yield* migrationSteps({ ...migrations, loader: Effect.fail(failure) }).pipe(Effect.flip)).toBe(failure);
				const loader = Effect.acquireRelease(migrations.loader, () =>
					Effect.sync(() => {
						closed = true;
					}),
				);
				const steps = yield* migrationSteps({ loader, lockTimeout: migrations.lockTimeout });
				expect(closed).toBe(false);
				yield* steps.migrateTo("1_create_contacts");
				expect(closed).toBe(false);
				yield* steps.migrateToLatest;
				expect(closed).toBe(false);
			}),
		),
	);
	expect(closed).toBe(true);
});

integration("steps can stop again, resume from the ledger and reject going backwards", async () => {
	await Effect.runPromise(
		runSteps(
			Effect.gen(function* () {
				const steps = yield* migrationSteps(migrations);
				yield* steps.migrateTo("1_create_contacts");
				yield* steps.migrateTo("2_backfill_emails");
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select email from contacts`).toEqual([]);
				expect(yield* steps.migrateTo("1_create_contacts").pipe(Effect.flip)).toMatchObject({
					_tag: "MigrationError",
					kind: "BadState",
					message: "Cannot migrate to 1: later migrations are already applied.",
				});
				const resumed = yield* migrationSteps(migrations);
				yield* resumed.migrateToLatest;
				yield* resumed.migrateToLatest;
				expect(yield* sql`select migration_id from ${sql(migrations.table)}`).toHaveLength(3);
			}),
		),
	);
});
