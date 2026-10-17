import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { assertModelColumns } from "#assertModelColumns.ts";
import { PostgresTestDatabase } from "#database.ts";
import { migrationUpgrade } from "#migrationUpgrade.ts";
import { Item, migrations, types } from "#test/migrationUpgrade.ts";
import { secondClient } from "#test/postgres.ts";
import type { UpgradeEngine } from "./upgradeStory.ts";
export function upgradeCommitVerbs(engine: UpgradeEngine) {
	return {
		populatedMixedCaseLedgerIsUntouched: () =>
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
					engine.runs += 1;
				});
				const loader = Effect.map(migrations.loader, (resolved) => {
					engine.loads += 1;
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
				expect(engine.loads).toBe(0);
				expect(engine.runs).toBe(0);
			}),
		upgradeCommitsOldSchema: () =>
			Effect.gen(function* () {
				const database = yield* PostgresTestDatabase;
				const observer = yield* secondClient(database.url);
				const resolved = yield* migrations.loader;
				const checkCommitted = Effect.gen(function* () {
					expect(yield* observer`select old_name from items`.withoutTransform).toEqual([{ "old_name": "kept" }]);
				});
				const loader = Effect.sync(() => {
					engine.loads += 1;
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
				expect(engine.loads).toBe(1);
			}),
	};
}
