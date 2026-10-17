import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { migrationSteps } from "#migrationSteps.ts";
import { migrations, runSteps } from "#test/migrationSteps.ts";
import { integration } from "#test/postgres.ts";

for (const target of ["002_backfill_emails", "2_backfill_emails", 2, "2", "002"]) {
	integration(`migration target ${JSON.stringify(target)} stops at the same migration on PostgreSQL`, async () => {
		await Effect.runPromise(
			runSteps(
				Effect.gen(function* () {
					const steps = yield* migrationSteps(migrations);
					yield* steps.migrateTo(target);
					const sql = yield* SqlClient.SqlClient;
					expect(yield* sql`select migration_id from ${sql(migrations.table)} order by migration_id`).toEqual([
						{ "migration_id": 1 },
						{ "migration_id": 2 },
					]);
					expect(yield* sql`select email from contacts`).toEqual([]);
					expect(yield* sql`select address from emails`).toEqual([]);
				}),
			),
		);
	});
}

for (const target of ["002_missing", "999", 999]) {
	integration(`unknown migration target ${JSON.stringify(target)} retains its typed error on PostgreSQL`, async () => {
		await Effect.runPromise(
			runSteps(
				Effect.gen(function* () {
					const steps = yield* migrationSteps(migrations);
					const error = yield* steps.migrateTo(target).pipe(Effect.flip);
					expect(error).toBeInstanceOf(Migrator.MigrationError);
					expect(error).toMatchObject({ kind: "BadState", message: `Migration "${target}" is not in the loader.` });
					const sql = yield* SqlClient.SqlClient;
					expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
				}),
			),
		);
	});
}

for (const target of ["001_create_contacts", "1_create_contacts", 1, "001"]) {
	integration(`ambiguous migration target ${JSON.stringify(target)} fails before changing PostgreSQL`, async () => {
		await Effect.runPromise(
			runSteps(
				Effect.gen(function* () {
					const loader = Migrator.fromRecord({ "1_create_contacts": Effect.void, "001_create_contacts": Effect.void });
					const steps = yield* migrationSteps({ ...migrations, loader });
					const error = yield* steps.migrateTo(target).pipe(Effect.flip);
					expect(error).toBeInstanceOf(Migrator.MigrationError);
					expect(error).toMatchObject({ kind: "BadState", message: `Migration "${target}" is ambiguous in the loader.` });
					const sql = yield* SqlClient.SqlClient;
					const ledger = sql`${sql(migrations.table)}`.compile()[0];
					expect(yield* sql`select to_regclass(${ledger}) as name`).toEqual([{ name: null }]);
				}),
			),
		);
	});
}
