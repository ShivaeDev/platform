import * as PgClient from "@effect/sql-pg/PgClient";
import { Cause, Config, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { HostState } from "./state.ts";

const inspect = Effect.fnUntraced(function* <A, E>(read: Effect.Effect<A, E, SqlClient.SqlClient>) {
	const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	return yield* read.pipe(Effect.provide(PgClient.layer({ url })));
});

export function serverOffersTls() {
	return inspect(SqlClient.SqlClient.use((sql) => sql<{ ssl: string }>`show ssl`)).pipe(Effect.map(([row]) => row?.ssl === "on"));
}

function connectionBackends(name: string) {
	return inspect(
		SqlClient.SqlClient.use(
			(sql) => sql<{ ssl: boolean }>`
			select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
			where a.datname = current_database() and a.application_name = ${name}`,
		),
	);
}

export const connectionSecurity = Effect.fn("HostStory.connectionSecurity")(function* (state: HostState) {
	const backends = yield* connectionBackends(state.applicationName ?? "");
	if (state.bootFailure !== undefined) {
		const refused = Cause.pretty(state.bootFailure).includes("Server refused TLS");
		return backends.length === 0 && refused ? "refused because the server lacks TLS" : `failed: ${Cause.pretty(state.bootFailure)}`;
	}
	if (backends.length === 0) {
		return "no connections";
	}
	if (backends.every((backend) => backend.ssl)) {
		return "TLS";
	}
	return backends.some((backend) => backend.ssl) ? "mixed" : "plain text";
});

export function dropConnectionLedger(table: string) {
	return inspect(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}`)).pipe(Effect.asVoid);
}
