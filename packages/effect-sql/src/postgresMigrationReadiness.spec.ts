import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Result, type Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect, test } from "vitest";
import { assertPostgresMigrations } from "#assertPostgresMigrations.ts";
import { migratePostgres } from "#migrations.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

function withLedger<A, E>(use: (table: string) => Effect.Effect<A, E, SqlClient.SqlClient | Scope.Scope>) {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const table = `readiness_${crypto.randomUUID().replaceAll("-", "")}`;
				yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(table)}`.pipe(Effect.orDie));
				return yield* use(table);
			}),
		).pipe(Effect.provide(PgClient.layer({ url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled") }))),
	);
}

integration("schema checks reject missing and pending migrations without executing them or creating a ledger", async () => {
	await withLedger((table) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const executed: string[] = [];
			const first = Migrator.fromRecord({ "1_first": Effect.sync(() => executed.push("first")) });
			const loader = Migrator.fromRecord({
				"1_first": Effect.sync(() => executed.push("first")),
				"2_second": Effect.sync(() => executed.push("second")),
			});
			const missing = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
			expect(Result.isFailure(missing) && missing.failure).toBeInstanceOf(Migrator.MigrationError);
			expect(yield* sql`select to_regclass(${table}) as ledger`).toEqual([{ ledger: null }]);
			expect(executed).toEqual([]);
			yield* migratePostgres({ loader: first, lockTimeout: "5 seconds", table });
			const pending = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
			expect(Result.isFailure(pending) && pending.failure._tag).toBe("MigrationError");
			expect(executed).toEqual(["first"]);
			yield* migratePostgres({ loader, lockTimeout: "5 seconds", table });
			yield* assertPostgresMigrations({ loader, table });
			yield* assertPostgresMigrations({ loader: first, table });
			expect(executed).toEqual(["first", "second"]);
		}),
	);
});

integration("schema checks reject a ledger whose required migration name does not match", async () => {
	await withLedger((table) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const loader = Migrator.fromRecord({ "1_original": Effect.void });
			yield* migratePostgres({ loader, lockTimeout: "5 seconds", table });
			yield* sql`update ${sql(table)} set name = 'different' where migration_id = 1`;
			const result = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
			expect(Result.isFailure(result) && result.failure._tag).toBe("MigrationError");
		}),
	);
});
