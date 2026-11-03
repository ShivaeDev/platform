import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

const connection = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
export const configured = connection.configured;
export const database = makePostgresTestLayer({
	initialize: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table tasks (id integer primary key, title text not null, due double precision)`;
		yield* sql`create table failures (name text not null, cause text not null)`;
		yield* sql`insert into tasks (id, title) values (1, 'initial')`;
	}),
	url: Redacted.make(connection.url ?? "postgresql://integration-tests-disabled"),
});
