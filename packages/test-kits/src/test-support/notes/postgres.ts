import { Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

export const notesMigrations = {
	loader: Migrator.fromRecord({
		"1_notes": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table notes (id serial primary key, owner text not null, title text not null)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};

export function notesPostgres(variable: string) {
	const { configured, url } = postgresTestUrl(variable);
	return {
		configured,
		layer: makePostgresTestLayer({ migrations: notesMigrations, url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	};
}
