import { randomUUID } from "node:crypto";
import { Effect } from "effect";
import { ROLE_PASSWORD } from "#test/credentials.ts";
import { postgres } from "#test/postgres.ts";
import { databaseUrl, type PostgresEngine, SERVER, usingCli } from "#test/postgresEngine.ts";

function uniqueName(prefix: string) {
	return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function queryRole() {
	return postgres.trait("service", `PostgreSQL has a query role whose password is ${ROLE_PASSWORD}`, (engine) =>
		Effect.acquireRelease(
			Effect.gen(function* () {
				const role = uniqueName("query_role");
				yield* usingCli(engine, engine.manager.sql(SERVER, `CREATE ROLE "${role}" LOGIN PASSWORD '${ROLE_PASSWORD}'`));
				engine.queryRole = role;
				return role;
			}),
			(role) => usingCli(engine, engine.manager.sql(SERVER, `DROP ROLE "${role}"`)).pipe(Effect.orDie),
		),
	);
}

function appDatabase(engine: PostgresEngine) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const name = uniqueName("local_postgres_story");
			engine.appDatabase = name;
			return name;
		}),
		(name) => usingCli(engine, engine.manager.sql(SERVER, `DROP DATABASE IF EXISTS "${name}"`)).pipe(Effect.orDie),
	);
}

export function appDatabaseMissing() {
	return postgres.trait("service", "the app database does not exist yet", (engine) => Effect.asVoid(appDatabase(engine)));
}

export function appDatabaseWithRow() {
	return postgres.trait("service", "setup prepared the app database earlier, and it holds the row 'existing data'", function* (engine) {
		const name = yield* appDatabase(engine);
		const url = databaseUrl(name);
		yield* usingCli(engine, engine.manager.prepareDatabases([url]));
		yield* usingCli(engine, engine.manager.sql(url, "CREATE TABLE kept (value text NOT NULL); INSERT INTO kept VALUES ('existing data')"));
	});
}
