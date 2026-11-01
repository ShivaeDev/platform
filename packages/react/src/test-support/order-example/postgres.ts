import { Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

export const { url: databaseUrl, configured: hasPostgres } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
export const migrations = {
	loader: Migrator.fromRecord({
		"1_orders": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table orders (id integer generated always as identity primary key, "ownerId" text not null, name text not null, quantity integer not null)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
export const orderDatabase = makePostgresTestLayer({
	migrations,
	url: Redacted.make(databaseUrl ?? "postgresql://disabled"),
});
