import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import type { HostState } from "./state.ts";

const connection = SqlClient.SqlClient.use(
	(sql) => sql`select inet_server_addr()::text as address, inet_server_port() as port, current_database() as database`,
);

export const databaseIdentity = Effect.gen(function* () {
	const client = yield* PgClient.PgClient;
	return { redacted: Redacted.isRedacted(client.config.url), rows: yield* connection };
});

export function databaseVerbs(state: HostState, tell: (line: string) => void) {
	return {
		databaseDestination: () => new URL(state.env.DATABASE_URL ?? ""),
		referenceConnection: () => {
			tell("an independent PostgreSQL client queries the same DATABASE_URL");
			return connection.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(state.env.DATABASE_URL ?? "") })));
		},
	};
}
