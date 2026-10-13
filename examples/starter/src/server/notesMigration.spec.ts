import { Redacted } from "effect";
import { assertModelColumns } from "@shivaedev/effect-test-sql/assertModelColumns.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { effectMigration } from "#test-support/postgres.ts";
import { makeAuth } from "./auth.ts";
import { StoredNote } from "./makeNotesRepository.ts";
import { migrations } from "./migrations.ts";

effectMigration("upgrades the pre-version notes table to every current model column and PostgreSQL type", function* () {
	const database = yield* PostgresTestDatabase;
	const { auth } = yield* makeAuth({ databaseUrl: database.url, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") });
	const columns = yield* migrationUpgrade({ migrations: migrations(auth), table: "starter_notes", upTo: 4 });
	yield* assertModelColumns(columns, StoredNote, { id: "integer", ownerId: "text", title: "text", version: "integer", wordCount: "integer" });
});
