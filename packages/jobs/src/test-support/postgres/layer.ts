import { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";

const { url, configured: postgresConfigured } = postgresTestUrl("PLATFORM_JOBS_TEST_DATABASE_URL");

export { postgresConfigured };

export const postgresLayer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
});
