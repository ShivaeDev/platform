import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";
import { type MigrationUpgradeOptions, migrationUpgrade, type PostgresColumn } from "#migrationUpgrade.ts";
import { makePostgresTestLayer } from "#postgres.ts";
import { adminUrl, configured } from "#test/postgres.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";

export class Item extends Model.Class<Item>("Item")({
	id: Model.GeneratedByDb(Schema.Number),
	name: Schema.String,
	price: Schema.NullOr(Schema.Number),
	publicLabel: Model.FieldOnly(["json"])(Schema.String),
}) {}

export const types = { id: "integer", name: "text", price: "numeric(10,2)" };

export const migrations = {
	loader: Migrator.fromRecord({
		"1_create_items": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table items (id serial primary key, old_name text not null, removed boolean)`;
			yield* sql`insert into items (old_name) values ('kept')`;
		}),
		"3_upgrade_items": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table items rename column old_name to name`;
			yield* sql`alter table items drop column removed`;
			yield* sql`alter table items add column price numeric(10,2)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
	table: "upgrade_migrations",
};

type Migrations = MigrationUpgradeOptions["migrations"];

export const app = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => migrations,
	layer: makePostgresTestLayer({ migrations, prepare: false, url: adminUrl }),
	name: "upgrade",
	runIf: configured,
	stages: ["ledger"],
	verbs: (base) => ({
		adding: (...extra: readonly Migrator.ResolvedMigration[]) =>
			Effect.map(base.loader, (resolved) => [...resolved, ...extra].sort(([left], [right]) => left - right)),
		assertModel: (columns: readonly PostgresColumn[]) => assertModelColumns(columns, Item, types),
		upgrade: (overrides: Partial<Migrations> = {}, upTo = 1) => migrationUpgrade({ migrations: { ...base, ...overrides }, table: "items", upTo }),
	}),
});

export const MIXED_CASE_LEDGER = "UpgradeMigrations";

export const populatedMixedCaseLedger = app.trait("ledger", "a mixed-case ledger already records the upgrade", () =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table ${sql(MIXED_CASE_LEDGER)} (
  migration_id integer primary key,
  created_at timestamp with time zone not null default now(),
  name text not null
)`;
		yield* sql`insert into ${sql(MIXED_CASE_LEDGER)} (migration_id, name) values (3, 'upgrade_items')`;
		yield* sql`create table items (id integer primary key, name text not null, price numeric(10,2))`;
		yield* sql`insert into items (id, name) values (1, 'kept')`;
	}),
);
