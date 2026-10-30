import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { ping } from "./ping.ts";
import { type HostState, io } from "./state.ts";

const connection = SqlClient.SqlClient.use(
	(sql) => sql`select inet_server_addr()::text as address, inet_server_port() as port, current_database() as database`,
);

export const databaseIdentity = Effect.gen(function* () {
	const client = yield* PgClient.PgClient;
	return { rows: yield* connection, url: Redacted.isRedacted(client.config.url) ? "redacted" : "plain" };
});

function destination(state: HostState) {
	return new URL(state.env.DATABASE_URL ?? "");
}

function identitySpan(state: HostState) {
	return state.nativeSpans.find((span) => String(span.attributes.get("db.query.text")).includes("inet_server_addr"));
}

export function databaseVerbs(state: HostState, tell: (line: string) => void) {
	return {
		databasePort: () => {
			const url = destination(state);
			return Effect.succeed(Number(url.searchParams.get("port") ?? url.port));
		},
		queryThroughHost: () => {
			tell("an RPC handler asks PostgreSQL which server and database it reached");
			return io(() => ping(`${state.url}/rpc`)).pipe(Effect.map((body): { readonly rows: unknown; readonly url: string } => JSON.parse(body)));
		},
		referenceConnection: () => {
			tell("an independent PostgreSQL client asks the server named by DATABASE_URL the same question");
			return connection.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(state.env.DATABASE_URL ?? "") })));
		},
		sqlSpanDestination: () =>
			Effect.sync(() => {
				const span = identitySpan(state);
				return span === undefined
					? "no SQL span recorded"
					: { address: span.attributes.get("server.address"), port: span.attributes.get("server.port") };
			}),
		sqlSpanSecrets: () =>
			Effect.sync(() => {
				const url = destination(state);
				const attributes = JSON.stringify(state.nativeSpans.map((span) => Object.fromEntries(span.attributes)));
				return [
					["the DATABASE_URL", url.toString()],
					["its credentials", `${url.username}:${url.password}`],
				]
					.filter(([, secret]) => secret !== undefined && attributes.includes(secret))
					.map(([name]) => name);
			}),
	};
}
