import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { LOCAL_SERVER } from "#localPostgres.ts";
import type { PostgresEngine } from "#test/postgresEngine.ts";
import { containerQuery } from "#test/realPostgres.ts";

export function createQueryRole(engine: PostgresEngine, password: string) {
	const role = `failure_${randomUUID().replaceAll("-", "")}`;
	const server = `${LOCAL_SERVER}/postgres`;
	return Effect.acquireRelease(
		Effect.sync(() => {
			engine.manager.sql(server, `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
			const connection = new URL(server);
			connection.username = role;
			return connection;
		}),
		() => Effect.sync(() => engine.manager.sql(server, `DROP ROLE "${role}"`)),
	);
}

export function queryWithClient(engine: PostgresEngine, client: "Docker" | "host-psql", connection: URL, query: string) {
	return client === "host-psql" ? engine.manager.sql(connection, query) : containerQuery(engine, connection, query);
}
