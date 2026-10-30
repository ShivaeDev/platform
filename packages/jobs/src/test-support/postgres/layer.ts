import { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { environmentVariable } from "@shivaedev/test-sql/server/adapters/environmentVariable.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

const url = environmentVariable("PLATFORM_JOBS_TEST_DATABASE_URL");
const ci = environmentVariable("CI") ?? "";
export const postgresConfigured = url !== undefined && url !== "";
if (!postgresConfigured && ci !== "") {
	throw new Error("CI requires PLATFORM_JOBS_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}

export const postgresLayer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});
