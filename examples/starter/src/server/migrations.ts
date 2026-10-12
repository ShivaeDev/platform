import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";

export const migrations = {
	loader: Migrator.fromRecord({
		"001_create_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table starter_notes (id serial primary key, title text not null)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
	table: "starter_migrations",
};
