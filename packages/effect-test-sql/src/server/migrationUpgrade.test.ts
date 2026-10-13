import { Cause, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { Item, migrations, runUpgrade, types } from "#test/migrationUpgrade.ts";
import { integration, secondClient } from "#test/postgres.ts";
import { assertModelColumns } from "./assertModelColumns.ts";
import { PostgresTestDatabase } from "./database.ts";
import { migrationUpgrade } from "./migrationUpgrade.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

integration("upgrades committed old migrations and returns exact live PostgreSQL column types", async () => {
	let loads = 0;
	await Effect.runPromise(
		runUpgrade(
			Effect.gen(function* () {
				const database = yield* PostgresTestDatabase;
				const observer = yield* secondClient(database.url);
				const resolved = yield* migrations.loader;
				const checkCommitted = Effect.gen(function* () {
					expect(yield* observer`select old_name from items`.withoutTransform).toEqual([{ "old_name": "kept" }]);
				});
				const loader = Effect.sync(() => {
					loads += 1;
					return [...resolved, [2, "check_committed", Effect.succeed(checkCommitted)] as const].sort(([left], [right]) => left - right);
				});
				const columns = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
				expect(columns).toEqual([
					{ name: "id", type: "integer" },
					{ name: "name", type: "text" },
					{ name: "price", type: "numeric(10,2)" },
				]);
				yield* assertModelColumns(columns, Item, types);
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select name from items`).toEqual([{ name: "kept" }]);
				expect(yield* sql`select migration_id from upgrade_migrations order by migration_id`).toEqual([
					{ "migration_id": 1 },
					{ "migration_id": 2 },
					{ "migration_id": 3 },
				]);
			}),
		),
	);
	expect(loads).toBe(1);
});

integration("rejects an unknown migration id, a populated ledger and a wrapping transaction", async () => {
	await Effect.runPromise(
		runUpgrade(
			Effect.gen(function* () {
				function check(upTo: number) {
					return migrationUpgrade({ migrations, table: "items", upTo });
				}
				expect((yield* check(2).pipe(Effect.flip)).message).toBe("Migration 2 is not in the loader.");
				expect((yield* withTestTransaction(check(1)).pipe(Effect.flip)).message).toContain("outside a wrapping transaction");
				yield* check(1);
				expect((yield* check(1).pipe(Effect.flip)).message).toContain("empty migration ledger");
			}),
		),
	);
});

integration("rejects a populated mixed-case ledger before loading or running migrations", async () => {
	let loads = 0;
	let runs = 0;
	await Effect.runPromise(
		runUpgrade(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const table = "UpgradeMigrations";
				yield* sql`create table ${sql(table)} (
  migration_id integer primary key,
  created_at timestamp with time zone not null default now(),
  name text not null
)`;
				yield* sql`insert into ${sql(table)} (migration_id, name) values (3, 'upgrade_items')`;
				yield* sql`create table items (id integer primary key, name text not null, price numeric(10,2))`;
				yield* sql`insert into items (id, name) values (1, 'kept')`;
				const pending = Effect.sync(() => {
					runs += 1;
				});
				const loader = Effect.map(migrations.loader, (resolved) => {
					loads += 1;
					return [...resolved, [4, "must_not_run", Effect.succeed(pending)] as const];
				});
				const failure = yield* migrationUpgrade({ migrations: { ...migrations, loader, table }, table: "items", upTo: 1 }).pipe(Effect.flip);
				expect(failure).toMatchObject({
					_tag: "MigrationError",
					kind: "BadState",
					message: "Migration upgrade checks require an empty migration ledger.",
				});
				expect(yield* sql`select migration_id from ${sql(table)}`).toEqual([{ "migration_id": 3 }]);
				expect(yield* sql`select name from items`).toEqual([{ name: "kept" }]);
			}),
		),
	);
	expect(loads).toBe(0);
	expect(runs).toBe(0);
});

for (const [name, statement, problem] of [
	["missing", "alter table items drop column price", "Missing column: price"],
	["extra", "alter table items add column surprise text", "Extra column: surprise"],
	["wrongly typed", "alter table items alter column name type varchar(30)", "Wrong type for name: expected text, received character varying(30)"],
] as const) {
	integration(`the model assertion fails for a ${name} PostgreSQL column`, async () => {
		await Effect.runPromise(
			runUpgrade(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const resolved = yield* migrations.loader;
					const loader = Effect.succeed([...resolved, [4, "drift", Effect.succeed(sql.unsafe(statement))] as const]);
					const columns = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
					expect((yield* assertModelColumns(columns, Item, types).pipe(Effect.flip)).problems).toEqual([problem]);
				}),
			),
		);
	});
}

integration("retains loader failures and migration defects while preserving the committed old schema", async () => {
	await Effect.runPromise(
		runUpgrade(
			Effect.gen(function* () {
				const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader failed" });
				const failedLoader = migrationUpgrade({ migrations: { ...migrations, loader: Effect.fail(failure) }, table: "items", upTo: 1 });
				expect(yield* failedLoader.pipe(Effect.flip)).toBe(failure);
				const resolved = yield* migrations.loader;
				const sql = yield* SqlClient.SqlClient;
				const loader = Effect.succeed([...resolved, [4, "broken", Effect.succeed(sql`alter table items drop column absent`)] as const]);
				const exit = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 }).pipe(Effect.exit);
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					expect(Cause.pretty(exit.cause)).toContain("MigrationError");
				}
				expect(yield* sql`select old_name from items`).toEqual([{ "old_name": "kept" }]);
				expect(yield* sql`select migration_id from upgrade_migrations`).toEqual([{ "migration_id": 1 }]);
			}),
		),
	);
});
