import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { assertModelColumns } from "#assertModelColumns.ts";
import { PostgresTestDatabase } from "#database.ts";
import { migrationUpgrade } from "#migrationUpgrade.ts";
import { Item, migrations, types } from "./migrationUpgrade.ts";
import { secondClient } from "./postgres.ts";
import type { UpgradeEngine } from "./upgradeStory.ts";
export function upgradeCommitVerbs(engine: UpgradeEngine) {
	return {
		checkModelColumns: (columns: Parameters<typeof assertModelColumns>[0]) => assertModelColumns(columns, Item, types),
		prepareMixedCaseLedger: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create table "UpgradeMigrations" (migration_id integer primary key, created_at timestamp with time zone not null default now(), name text not null)`;
				yield* sql`insert into "UpgradeMigrations" (migration_id, name) values (3, 'upgrade_items')`;
				yield* sql`create table items (id integer primary key, name text not null, price numeric(10,2))`;
				yield* sql`insert into items (id, name) values (1, 'kept')`;
			}),
		readItemNames: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select name from items`),
		readOldNames: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select old_name from items`),
		readUpgradeCounts: () => Effect.sync(() => ({ loads: engine.loads, runs: engine.runs })),
		readUpgradeLedger: (table = migrations.table) =>
			Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select migration_id from ${sql(table)} order by migration_id`),
		upgradeMixedCaseLedger: () =>
			Effect.gen(function* () {
				const pending = Effect.sync(() => {
					engine.runs += 1;
				});
				const loader = Effect.map(migrations.loader, (resolved) => {
					engine.loads += 1;
					return [...resolved, [4, "must_not_run", Effect.succeed(pending)] as const];
				});
				return yield* migrationUpgrade({ migrations: { ...migrations, loader, table: "UpgradeMigrations" }, table: "items", upTo: 1 });
			}),
		upgradeWithObserver: () =>
			Effect.gen(function* () {
				const database = yield* PostgresTestDatabase;
				const observer = yield* secondClient(database.url);
				const resolved = yield* migrations.loader;
				const committed: unknown[] = [];
				const checkCommitted = Effect.gen(function* () {
					committed.push(...(yield* observer`select old_name from items`.withoutTransform));
				});
				const loader = Effect.sync(() => {
					engine.loads += 1;
					return [...resolved, [2, "check_committed", Effect.succeed(checkCommitted)] as const].sort(([left], [right]) => left - right);
				});
				const columns = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
				return { columns, committed };
			}),
	};
}
