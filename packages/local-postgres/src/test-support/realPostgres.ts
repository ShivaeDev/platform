import { randomUUID } from "node:crypto";
import { sqlInContainer } from "#localContainer.ts";
import { docker } from "#localDocker.ts";
import { localServer } from "#localPostgres.ts";
import type { PostgresEngine } from "#test/postgresEngine.ts";

export function containerQuery(engine: PostgresEngine, connection: URL, query: string) {
	return sqlInContainer(
		(args, options) => docker(engine.environment, args, options),
		connection,
		["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
}

export function queryAsNewRole(engine: PostgresEngine) {
	const role = `client_${randomUUID().replaceAll("-", "")}`;
	engine.manager.sql(`${localServer}/postgres`, `CREATE ROLE "${role}" LOGIN PASSWORD 'local-client-fixture-password'`);
	try {
		const connection = new URL(`${localServer}/postgres`);
		connection.username = role;
		connection.password = encodeURIComponent("local-client-fixture-password");
		return { result: containerQuery(engine, connection, "SELECT session_user, current_database()"), role };
	} finally {
		engine.manager.sql(`${localServer}/postgres`, `DROP ROLE "${role}"`);
	}
}

export function prepareTwice(engine: PostgresEngine) {
	const url = `${localServer}/platform_test_local_postgres`;
	engine.manager.prepareDatabases([url]);
	const table = `setup_preservation_${randomUUID().replaceAll("-", "")}`;
	engine.manager.sql(url, `CREATE TABLE "${table}" (value text NOT NULL)`);
	try {
		engine.manager.sql(url, `INSERT INTO "${table}" VALUES ('preserved')`);
		engine.manager.prepareDatabases([url]);
		return {
			value: engine.manager.sql(url, `SELECT value FROM "${table}"`),
			version: engine.manager.sql(`${url}?schema=public&connection_limit=1`, "SHOW server_version"),
		};
	} finally {
		engine.manager.sql(url, `DROP TABLE "${table}"`);
	}
}
