import { readFileSync } from "node:fs";
import { Config, Effect } from "effect";
import { assertLocalDatabase, LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";

if (Effect.runSync(Config.String("NODE_ENV").pipe(Config.withDefault(""))) === "production") {
	throw new Error("Local setup must not run in production.");
}

const { prepareDatabases, sql } = localPostgres(
	Effect.runSync(
		Config.all({
			"DOCKER_CONTEXT": Config.String("DOCKER_CONTEXT").pipe(Config.withDefault("")),
			"DOCKER_HOST": Config.String("DOCKER_HOST").pipe(Config.withDefault("")),
		}),
	),
);
const development = Effect.runSync(Config.String("DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/platform_dev`)));
const tests = Effect.runSync(postgresTestEnvironment);
assertLocalDatabase(development, ["platform_dev"]);
prepareDatabases([development, ...Object.values(tests)]);
for (const schema of ["packages/effect-prisma/src/test-support/schema.sql", "packages/platform/src/test-support/auth/schema.sql"]) {
	const source = readFileSync(schema, "utf8")
		.replaceAll("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
		.replaceAll("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ");
	sql(tests.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL, source);
}
Effect.runSync(Effect.log("Local development and integration databases are ready."));
