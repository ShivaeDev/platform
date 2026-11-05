import { Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
export const hasPostgres = configured;
export const database = makePostgresTestLayer({
	migrations: {
		loader: Migrator.fromRecord({
			"1_batch_undo": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create table batch_undo_rows (id text primary key, portion double precision not null, version integer not null)`;
				yield* sql`insert into batch_undo_rows values ('first', 1, 2), ('second', 2, 7), ('third', 3, 11)`;
			}),
		}),
		lockTimeout: "5 seconds",
	},
	url: Redacted.make(url ?? "postgresql://disabled"),
});
