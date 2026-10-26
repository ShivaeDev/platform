import { Effect, Result } from "effect";
import { Migrator } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"schema checks reject missing and pending migrations without executing them or creating a ledger",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, assertPostgresMigrations, pendingPostgresMigrations }) {
		const table = migrations().ledger;

		const executed: string[] = [];
		const first = Migrator.fromRecord({ "1_first": Effect.sync(() => executed.push("first")) });
		const loader = Migrator.fromRecord({
			"1_first": Effect.sync(() => executed.push("first")),
			"2_second": Effect.sync(() => executed.push("second")),
		});
		expect(yield* pendingPostgresMigrations({ loader, table })).toEqual({
			components: [],
			migrations: [
				{ id: 1, name: "first" },
				{ id: 2, name: "second" },
			],
		});
		const missing = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
		expect(Result.isFailure(missing) && missing.failure).toBeInstanceOf(Migrator.MigrationError);
		expect(Result.isFailure(missing) && missing.failure).toMatchObject({ kind: "BadState" });
		expect(yield* sql`select to_regclass(${table}) as ledger`).toEqual([{ ledger: null }]);
		expect(executed).toEqual([]);
		yield* migratePostgres({ loader: first, lockTimeout: "5 seconds", table });
		expect(yield* pendingPostgresMigrations({ loader, table })).toEqual({ components: [], migrations: [{ id: 2, name: "second" }] });
		const pending = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
		expect(Result.isFailure(pending) && pending.failure).toBeInstanceOf(Migrator.MigrationError);
		expect(Result.isFailure(pending) && pending.failure).toMatchObject({ kind: "BadState" });
		expect(executed).toEqual(["first"]);
		yield* migratePostgres({ loader, lockTimeout: "5 seconds", table });
		yield* assertPostgresMigrations({ loader, table });
		yield* assertPostgresMigrations({ loader: first, table });
		expect(executed).toEqual(["first", "second"]);
	},
);

postgres.it(
	"schema checks reject a ledger whose required migration name does not match",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, assertPostgresMigrations, pendingPostgresMigrations }) {
		const table = migrations().ledger;

		const loader = Migrator.fromRecord({ "1_original": Effect.void });
		yield* migratePostgres({ loader, lockTimeout: "5 seconds", table });
		yield* sql`update ${sql(table)} set name = 'different' where migration_id = 1`;
		expect(yield* pendingPostgresMigrations({ loader, table })).toEqual({ components: [], migrations: [{ id: 1, name: "original" }] });
		const result = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
		expect(Result.isFailure(result) && result.failure).toBeInstanceOf(Migrator.MigrationError);
		expect(Result.isFailure(result) && result.failure).toMatchObject({ kind: "BadState" });
	},
);

postgres.it(
	"schema checks preserve a database failure as a typed SqlError",
	[hasMigrationTables()],
	function* ({ migrations, sql, assertPostgresMigrations }) {
		const table = migrations().ledger;

		const loader = Migrator.fromRecord({ "1_first": Effect.void });
		yield* sql`create table ${sql(table)} (migration_id integer primary key)`;
		const result = yield* assertPostgresMigrations({ loader, table }).pipe(Effect.result);
		expect(Result.isFailure(result) && result.failure).toBeInstanceOf(SqlError);
		expect(Result.isFailure(result) && result.failure).toMatchObject({
			reason: { _tag: "SqlSyntaxError", cause: { code: "42703", message: 'column "name" does not exist' } },
		});
	},
);
