import { Effect } from "effect";
import { Migrator } from "effect/sql";
import type { Pool } from "pg";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";
import { createNotes } from "#server/migrations/0001_create_notes.ts";
import { createAuth } from "#server/migrations/0002_create_auth.ts";
import { noteOwner } from "#server/migrations/0003_note_owner.ts";
import { noteWordCount } from "#server/migrations/0004_note_word_count.ts";
import { noteVersion } from "#server/migrations/0005_note_version.ts";
import { authAdmin } from "#server/migrations/0006_auth_admin.ts";
import { noteSnakeCase } from "#server/migrations/0007_note_snake_case.ts";

export function migrations(database: Pool) {
	return {
		loader: Migrator.fromRecord({
			"1_create_notes": createNotes,
			"2_create_auth": createAuth.pipe(Effect.provideService(AuthMigrationDatabase, database)),
			"3_note_owner": noteOwner,
			"4_note_word_count": noteWordCount,
			"5_note_version": noteVersion,
			"6_auth_admin": authAdmin.pipe(Effect.provideService(AuthMigrationDatabase, database)),
			"7_note_snake_case": noteSnakeCase,
		}),
		table: "app_migrations",
	};
}
