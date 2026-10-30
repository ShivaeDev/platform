import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";
import { PostgresTestDatabase } from "#database.ts";
import { migrationUpgrade, type PostgresColumn } from "#migrationUpgrade.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { Item, layer, migrations, types } from "./migrationUpgrade.ts";
import { attempt, failureOf, timesOf } from "./outcome.ts";
import { configured, secondClient } from "./postgres.ts";

export interface UpgradeEngine {
	columns: readonly PostgresColumn[];
	drift: string | undefined;
	ledger: string;
	loads: number;
	seenByLaterMigration: readonly string[];
	upgrade: string;
}

type Loader = Effect.Effect<readonly Migrator.ResolvedMigration[], Migrator.MigrationError, SqlClient.SqlClient>;

export const upgrade = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): UpgradeEngine => ({
		columns: [],
		drift: undefined,
		ledger: migrations.table,
		loads: 0,
		seenByLaterMigration: [],
		upgrade: "not attempted",
	}),
	inspect: (engine) => ({ drift: engine.drift, loads: engine.loads, upgrade: engine.upgrade }),
	layer,
	name: "migration upgrade",
	runIf: configured,
	stages: ["schema"],
	verbs: (engine, story) => {
		function counted(extra: readonly Migrator.ResolvedMigration[]): Loader {
			return Effect.map(migrations.loader, (resolved) => {
				engine.loads += 1;
				return [...resolved, ...extra].sort(([left], [right]) => left - right);
			});
		}
		function run(loader: Loader, upTo = 1) {
			return Effect.gen(function* () {
				const upgraded = migrationUpgrade({ migrations: { ...migrations, loader, table: engine.ledger }, table: "items", upTo });
				engine.upgrade = yield* attempt(
					Effect.map(upgraded, (columns) => {
						engine.columns = columns;
					}),
				);
			});
		}
		function sqlRun(statement: string) {
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql.unsafe(statement));
		}
		return {
			appliedMigrations: () =>
				Effect.flatMap(SqlClient.SqlClient, (sql) =>
					Effect.map(sql<{ id: number }>`select migration_id as id from ${sql(engine.ledger)} order by migration_id`, (rows) =>
						rows.map(({ id }) => id),
					),
				),
			columns: () => Effect.sync(() => engine.columns),
			itemNamesInOldColumn: () =>
				Effect.flatMap(SqlClient.SqlClient, (sql) =>
					Effect.map(sql<{ name: string }>`select old_name as name from items`, (rows) => rows.map(({ name }) => name)),
				),
			loaderResolutions: () => Effect.sync(() => timesOf(engine.loads)),
			modelCheck: () =>
				assertModelColumns(engine.columns, Item, types).pipe(
					Effect.as("matches the model"),
					Effect.catch((mismatch) => Effect.succeed(failureOf(mismatch))),
				),
			rowsSeenByLaterMigration: () => Effect.sync(() => engine.seenByLaterMigration),
			runUpgrade: () => {
				story.tell("the upgrade commits migration 1 and then applies the rest");
				return run(counted(engine.drift === undefined ? [] : [[4, "drift", Effect.succeed(sqlRun(engine.drift))]]));
			},
			upgradeFrom: (upTo: number) => {
				story.tell(`the upgrade starts from migration ${upTo}`);
				return run(counted([]), upTo);
			},
			upgradeInRollbackTest: () => {
				story.tell("a rollback test runs the upgrade");
				return Effect.gen(function* () {
					engine.upgrade = yield* attempt(withTestTransaction(migrationUpgrade({ migrations, table: "items", upTo: 1 })));
				});
			},
			upgradeOutcome: () => Effect.sync(() => engine.upgrade),
			upgradeWatchedByLaterMigration: () =>
				Effect.gen(function* () {
					story.tell("the upgrade runs with a migration 2 that reads the items through another connection");
					const database = yield* PostgresTestDatabase;
					const observer = yield* secondClient(database.url);
					const watch = Effect.gen(function* () {
						const rows = yield* observer<{ name: string }>`select old_name as name from items`.withoutTransform;
						engine.seenByLaterMigration = rows.map(({ name }) => name);
					});
					yield* run(counted([[2, "watch_committed", Effect.succeed(watch)]]));
				}),
			upgradeWithFailingLaterMigration: () => {
				story.tell("the upgrade runs with a migration 4 that drops a column that does not exist");
				return run(counted([[4, "broken", Effect.succeed(sqlRun("alter table items drop column absent"))]]));
			},
			upgradeWithFailingLoader: () => {
				story.tell("the upgrade runs with a loader that fails with ImportError");
				return run(Effect.fail(new Migrator.MigrationError({ kind: "ImportError", message: "loader failed" })));
			},
		};
	},
});

export function columnDrift(statement: string) {
	return upgrade.trait("schema", `a migration after the upgrade runs: ${statement}`, (engine) => {
		engine.drift = statement;
	});
}

export const populatedMixedCaseLedger = upgrade.trait("schema", 'the ledger "UpgradeMigrations" already records migration 3', function* (engine) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table "UpgradeMigrations" (migration_id integer primary key, created_at timestamp with time zone not null default now(), name text not null)`;
	yield* sql`insert into "UpgradeMigrations" (migration_id, name) values (3, 'upgrade_items')`;
	engine.ledger = "UpgradeMigrations";
});
