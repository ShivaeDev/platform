import { readFileSync } from "node:fs";
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres";
import { Config, Effect } from "effect";
import { postgresTestEnvironment } from "#lib/postgres-test-environment.ts";

if (Effect.runSync(Config.string("NODE_ENV").pipe(Config.withDefault(""))) === "production") {
	throw new Error("Local setup must not run in production.");
}

const { prepareDatabases, sql } = localPostgres(
	Effect.runSync(
		Config.all({
			DOCKER_CONTEXT: Config.string("DOCKER_CONTEXT").pipe(Config.withDefault("")),
			DOCKER_HOST: Config.string("DOCKER_HOST").pipe(Config.withDefault("")),
		}),
	),
);
const development = Effect.runSync(Config.string("DATABASE_URL").pipe(Config.withDefault(`${localServer}/platform_dev`)));
const tests = Effect.runSync(postgresTestEnvironment);
assertLocalDatabase(development, ["platform_dev"]);
prepareDatabases([development, ...Object.values(tests)]);
for (const schema of ["packages/effect-prisma/test/schema.sql", "packages/platform/test/auth/schema.sql"]) {
	const source = readFileSync(schema, "utf8")
		.replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
		.replaceAll("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");
	sql(tests.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL, source);
}
Effect.runSync(Effect.log("Local development and integration databases are ready."));
