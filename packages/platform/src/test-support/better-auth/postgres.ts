import { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { environmentVariable } from "#test/environmentVariable.ts";

export const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
export const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});
