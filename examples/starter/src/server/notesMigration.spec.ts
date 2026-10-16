import { assertModelColumns } from "@shivaedev/effect-test-sql/assertModelColumns.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/migrationUpgrade.ts";
import { effectMigration } from "#test-support/postgres.ts";
import { authDatabase } from "./authDatabase.ts";
import { StoredNote } from "./makeNotesRepository.ts";
import { migrations } from "./migrations.ts";

effectMigration("upgrades the pre-version notes table to every current model column and PostgreSQL type", function* () {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const columns = yield* migrationUpgrade({ migrations: { ...migrations(pool), lockTimeout: "5 seconds" }, table: "starter_notes", upTo: 4 });
	yield* assertModelColumns(columns, StoredNote, { id: "integer", ownerId: "text", title: "text", version: "integer", wordCount: "integer" });
});
