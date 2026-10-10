import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";

export const migrateFleet = Effect.fn("FleetStore.migrateFleet")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* migratePostgres({
		loader: Migrator.fromRecord({
			"1_fleet_records": Effect.gen(function* () {
				yield* sql`create table ${sql(`${namespace}_records`)} (work_id text primary key, version integer not null check (version > 0), payload jsonb not null)`;
				yield* sql`create table ${sql(`${namespace}_foreign_reservations`)} (owner text primary key, paths jsonb not null, executing boolean not null, backlog boolean not null)`;
			}),
		}),
		lockTimeout: "5 seconds",
		table: `${namespace}_migrations`,
	});
});
