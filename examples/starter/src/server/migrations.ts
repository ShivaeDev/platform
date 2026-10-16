import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { Pool } from "pg";
import { authOptions } from "./authOptions.ts";

export function migrations(database: Pool) {
	return {
		loader: Migrator.fromRecord({
			"001_create_notes": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create table starter_notes (id serial primary key, title text not null)`;
			}),
			"002_create_auth": Effect.tryPromise(async () => {
				const migration = await getMigrations(authOptions(database));
				await migration.runMigrations();
			}),
			"003_note_owner": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table starter_notes add column "ownerId" text`;
			}),
			"004_note_word_count": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table starter_notes add column "wordCount" integer`;
				yield* sql`update starter_notes set "wordCount" = cardinality(regexp_split_to_array(trim(title), '[[:space:]]+'))`;
			}),
			"005_note_version": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table starter_notes add column version integer not null default 0`;
			}),
		}),
		table: "starter_migrations",
	};
}
