import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect } from "effect";
import { SqlClient } from "effect/sql";

const inspect = Effect.fnUntraced(function* <A, E>(read: Effect.Effect<A, E, SqlClient.SqlClient>) {
	const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	return yield* read.pipe(Effect.provide(PgClient.layer({ url })));
});

export function serverTls() {
	return inspect(SqlClient.SqlClient.use((sql) => sql<{ ssl: string }>`show ssl`)).pipe(Effect.map(([row]) => row?.ssl === "on"));
}

export function connectionBackends(name: string) {
	return inspect(
		SqlClient.SqlClient.use(
			(sql) => sql<{ ssl: boolean }>`
			select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
			where a.datname = current_database() and a.application_name = ${name}`,
		),
	);
}

export function dropConnectionLedger(table: string) {
	return inspect(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}`)).pipe(Effect.asVoid);
}
