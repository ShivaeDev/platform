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
			"2_occupancy_only_foreign_reservations": sql`alter table ${sql(`${namespace}_foreign_reservations`)} drop column paths`,
			"3_attention_owner": sql`update ${sql(`${namespace}_records`)} set version = version + 1,
				payload = jsonb_set(payload, '{attentionOwner}',
					case when payload->>'stage' = 'validating' and payload->'checks'->>'pending' = 'true'
						then '"automation"'::jsonb else '"orchestrator"'::jsonb end)
				where payload->>'attentionOwner' is null and
					(payload->>'stage' = 'needs-human' or payload->>'blocker' is not null or
					(payload->>'stage' = 'validating' and payload->'checks'->>'pending' = 'true'))`,
		}),
		lockTimeout: "5 seconds",
		table: `${namespace}_migrations`,
	});
});
