import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { AppAuth } from "./auth.ts";

export function migrations(auth: AppAuth) {
	return {
		loader: Migrator.fromRecord({
			"001_create_notes": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create table notes (id serial primary key, title text not null)`;
			}),
			"002_create_auth": Effect.tryPromise(async () => {
				const migration = await getMigrations(auth.options);
				await migration.runMigrations();
			}),
			"003_note_owner": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table notes add column "ownerId" text`;
			}),
			"004_note_word_count": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table notes add column "wordCount" integer`;
				yield* sql`update notes set "wordCount" = cardinality(regexp_split_to_array(trim(title), '[[:space:]]+'))`;
			}),
			"005_note_version": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table notes add column version integer not null default 0`;
			}),
		}),
		lockTimeout: "5 seconds" as const,
		table: "app_migrations",
	};
}
