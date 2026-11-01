import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";

class Note extends Model.Class<Note>("MigrationNote")({ id: Schema.Number, title: Schema.String }) {}

export function migrationChangesLoader(table: string, mode: "initial" | "migrate" | "rollback") {
	const initial = SqlClient.SqlClient.use((sql) => sql`create table ${sql(table)} (id integer primary key, title text not null)`);
	const write = Effect.gen(function* () {
		const notes = yield* makeRepository(Note, { idColumn: "id", spanPrefix: "MigrationNote", tableName: table });
		yield* notes.insert({ id: 1, title: "Draft" });
		yield* notes.update({ id: 1, title: "Published" });
		yield* notes.insert({ id: 2, title: "Another note" });
	});
	return Migrator.fromRecord(
		mode === "initial"
			? { "001_notes": initial }
			: {
					"001_notes": initial,
					"002_write": write,
					"003_finish": mode === "rollback" ? Effect.fail(new Error("Migration rejected")) : Effect.void,
				},
	);
}
